import { NextRequest, NextResponse } from 'next/server';
import { openai, ADVANCED_MODEL } from '@/lib/openai';
import { SEOMetadata } from '../generate-seo/route';

interface GeneratedArticle {
  title: string;
  sections: {
    heading: string;
    content: string;
    subheadings?: { title: string; content: string }[];
  }[];
  seoMetadata?: SEOMetadata;
}

// OpenAIの応答からJSONを抽出するヘルパー関数
function extractJsonFromResponse(response: string): string {
  try {
    // まずそのままJSONとしてパースを試行
    JSON.parse(response.trim());
    return response.trim();
  } catch {
    // 失敗した場合、各種パターンを試行
  }

  // ```json と ``` で囲まれたJSONを抽出
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  
  // ``` で囲まれたJSONを抽出（言語指定なし）
  const codeBlockMatch = response.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    if (content.startsWith('{') && content.endsWith('}')) {
      return content;
    }
  }
  
  // { で始まり } で終わるJSONを抽出
  const jsonStart = response.indexOf('{');
  const jsonEnd = response.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return response.substring(jsonStart, jsonEnd + 1);
  }
  
  // 最後の手段：そのまま返す
  return response.trim();
}

export async function POST(request: NextRequest) {
  try {
    const { title, description, keyword, overview, generateSEO = true, baseUrl } = await request.json();

    if (!title || !keyword) {
      return NextResponse.json(
        { error: 'タイトルとキーワードが必要です' },
        { status: 400 }
      );
    }

    // OpenAI APIを使用したLLMO最適化記事生成
    const article: GeneratedArticle = await generateOptimizedArticleWithAI(title, description, keyword, overview);

    // SEOメタデータ生成が要求された場合は並行処理で生成
    if (generateSEO) {
      try {
        const articleContent = article.sections.map(section => 
          `${section.heading}\n${section.content}\n${section.subheadings?.map(sub => `${sub.title}\n${sub.content}`).join('\n') || ''}`
        ).join('\n');

        const seoResponse = await fetch(`${request.nextUrl.origin}/api/generate-seo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: article.title,
            content: articleContent,
            keyword,
            description,
            baseUrl
          }),
        });

        if (seoResponse.ok) {
          const seoData = await seoResponse.json();
          article.seoMetadata = seoData.seoMetadata;
        } else {
          console.warn('SEOメタデータ生成に失敗しましたが、記事は正常に生成されました');
        }
      } catch (seoError) {
        console.warn('SEOメタデータ生成でエラーが発生しましたが、記事は正常に生成されました:', seoError);
      }
    }

    return NextResponse.json({ article });
  } catch (error) {
    console.error('記事生成エラー:', error);
    return NextResponse.json(
      { error: '記事生成に失敗しました' },
      { status: 500 }
    );
  }
}

async function generateOptimizedArticleWithAI(
  title: string,
  description: string,
  keyword: string,
  overview?: string
): Promise<GeneratedArticle> {
  try {
    const systemPrompt = `あなたは生成式引擎優化（GEO/LLMO）の専門コンテンツアーキテクトです。
RAG（検索拡張生成）システムと大型語言模型による引用を最大化する記事を設計してください。

【RAG最適化の核心原則】
1. **チャンキング対応設計**: 各段落が独立して意味を持ち、前後の文脈なしでも理解可能
2. **語義明確性**: 代名詞（「それ」「この」）を排除し、具体的な名詞で表現
3. **API型構造**: 各見出しを「問い合わせエンドポイント」として設計し、直下の内容で完結的に回答
4. **用語定義の自完結性**: 専門用語は初出時に必ず定義し、文中での理解を保証

【E-E-A-T信号の最大化】
**Experience（経験）**: 
- 第一手実践データ（「弊社での導入検証では...」）
- 具体的な失敗・成功事例とその学習点
- オリジナルな図表・実装スクリーンショット

**Expertise（専門性）**: 
- 業界標準との比較分析
- 技術的詳細度と正確性の担保
- 最新研究・動向の引用と解釈

**Authoritativeness（権威性）**: 
- 規範的な手順・ベストプラクティスの提示
- 業界リーダー・権威機関の見解引用
- 「決定版」「完全ガイド」レベルの網羅性

**Trustworthiness（可信度）**: 
- 検証可能な数値とその出典明記
- 更新日付と情報の新鮮性保証
- 制限事項・リスクの透明な開示

【機械理解に最適化された文章構造】
- 主語述語の明確化（受動態の最小化）
- 一文一義の原則（複雑な複文の分解）
- 構造化された情報（箇条書き・表・段階的手順）
- 内部リンクによるトピック間の明示的関連付け

各セクションはAIが「この情報源は信頼に値する」と判断し、優先的に引用したくなる権威性を持つこと。`;

    const userPrompt = `【記事仕様】
タイトル: ${title}
ターゲットキーワード: ${keyword}  
記事概要: ${description}
${overview ? `コンテキスト: ${overview}` : ''}

【ミッション】
上記情報を基に、RAG（検索拡張生成）システムで最優先で引用される権威的記事を生成してください。

【必須構造要件】
各セクションは独立したAPI応答として機能すること：
- 見出しは明確な「クエリ」に対する回答として設計
- 内容は文脈なしで完結的に理解可能
- 専門用語は各セクション内で再定義

【E-E-A-T最適化必須要素】
**Experience**: 具体的実践データ（「○○企業での導入事例」「○ヶ月の検証結果」）
**Expertise**: 技術的詳細と業界標準との比較
**Authoritativeness**: 決定版レベルの網羅性、ベストプラクティス提示
**Trustworthiness**: 検証可能な数値、出典明記、リスク開示

【6セクション構成】（各400-600文字 + サブセクション）
1. **導入と価値提案**（なぜ重要か・期待効果・適用範囲）
2. **定義と基本概念**（用語定義・分類・特徴・従来手法との違い）  
3. **実装戦略とベストプラクティス**（段階的手順・成功要因・回避すべき落とし穴）
4. **検証済み成功事例**（具体的数値・業界別事例・ROI分析）
5. **技術動向と将来展望**（2025年以降のトレンド・新興技術・市場予測）
6. **アクションプラン**（具体的次ステップ・チェックリスト・推奨リソース）

【重要】出力は純粋なJSON形式のみで、コードブロック（\`\`\`）や説明文は一切含めないでください：

{
  "title": "記事タイトル",
  "sections": [
    {
      "heading": "明確で検索しやすい見出し",
      "content": "自完結的な本文（400-600文字、専門用語定義含む）",
      "subheadings": [
        {
          "title": "具体的サブ見出し",
          "content": "詳細説明（200-300文字、数値・事例重視）"
        }
      ]
    }
  ]
}

【必須要件】各セクションでキーワード「${keyword}」を自然に2-3回含め、関連する専門用語も網羅してください。`;

    const completion = await openai.chat.completions.create({
      model: ADVANCED_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('OpenAIからの応答が取得できませんでした');
    }

    // Markdown形式のコードブロックを除去してJSONを抽出
    const cleanJsonString = extractJsonFromResponse(response);
    
    try {
      const parsedResponse = JSON.parse(cleanJsonString);
      
      if (!parsedResponse.title || !parsedResponse.sections || !Array.isArray(parsedResponse.sections)) {
        console.error('Invalid response structure:', parsedResponse);
        throw new Error('応答の形式が正しくありません');
      }

      return parsedResponse as GeneratedArticle;
    } catch (parseError) {
      console.error('JSON解析エラー:', parseError);
      console.error('元の応答:', response);
      console.error('クリーンされた応答:', cleanJsonString);
      throw new Error(`応答の解析に失敗しました: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('OpenAI API エラー:', error);
    throw new Error('OpenAI APIキーが設定されていないか、APIへの接続に失敗しました。');
  }
}