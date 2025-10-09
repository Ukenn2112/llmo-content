import { NextRequest, NextResponse } from 'next/server';
import { openai, ADVANCED_MODEL } from '@/lib/openai';

export interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  metaRobots: string;
  canonicalUrl?: string;
  structuredData?: {
    type: string;
    name: string;
    description: string;
    author: string;
    datePublished: string;
    dateModified: string;
    keywords: string[];
  };
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
    const { title, content, keyword, description, baseUrl } = await request.json();

    if (!title || !keyword) {
      return NextResponse.json(
        { error: 'タイトルとキーワードが必要です' },
        { status: 400 }
      );
    }

    // OpenAI APIを使用してSEOメタデータを生成
    const seoMetadata = await generateSEOMetadataWithAI(title, content, keyword, description, baseUrl);

    return NextResponse.json({ seoMetadata });
  } catch (error) {
    console.error('SEOメタデータ生成エラー:', error);
    return NextResponse.json(
      { error: 'SEOメタデータの生成に失敗しました' },
      { status: 500 }
    );
  }
}

async function generateSEOMetadataWithAI(
  title: string,
  content: string,
  keyword: string,
  description?: string,
  baseUrl?: string
): Promise<SEOMetadata> {
  try {
    const systemPrompt = `あなたはSEO（検索エンジン最適化）とLLMO（Large Language Model Optimization）の専門家です。
記事コンテンツに基づいて、検索エンジンと生成AIの両方に最適化された包括的なSEOメタデータを生成してください。

【SEO最適化の核心原則】
1. **従来のSEO**: Google、Bing等の検索エンジン向け最適化
2. **LLMO/GEO**: ChatGPT、Claude、Gemini等の生成AI向け最適化
3. **ハイブリッド戦略**: 両者を統合した次世代SEO戦略

【E-E-A-T信号の強化】
- **Experience（経験）**: 実践的な知見を示すメタデータ
- **Expertise（専門性）**: 技術的専門性を表現する用語選択
- **Authoritativeness（権威性）**: 信頼できる情報源としての位置づけ
- **Trustworthiness（可信度）**: 透明性と検証可能性を示す要素

【生成AI向け最適化】
- **語義明確性**: 代名詞を避け、具体的な名詞を使用
- **構造化情報**: JSONスキーマに対応した構造化データ
- **独立性**: メタデータ単体で理解可能な情報設計
- **権威性シグナル**: AI引用率向上のための信頼性指標

【現代SEOベストプラクティス】
- タイトルタグ: 50-60文字以内、キーワード前方配置
- メタディスクリプション: 150-160文字、魅力的なCTAを含む
- OGメタデータ: SNSシェア時の最適表示
- 構造化データ: schema.org準拠のArticleスキーマ`;

    const userPrompt = `【コンテンツ情報】
タイトル: ${title}
メインキーワード: ${keyword}
${description ? `記事概要: ${description}` : ''}
${content ? `記事内容（抜粋）: ${content.substring(0, 1000)}...` : ''}
${baseUrl ? `ベースURL: ${baseUrl}` : ''}

【タスク】
上記の記事情報に基づいて、以下の要件を満たすSEOメタデータを生成してください。

【必須要件】
1. **従来SEO最適化**: 
   - Google検索での上位表示を狙う最適な長さと構造
   - 自然なキーワード配置（過度なstuffingを避ける）
   - ユーザーのクリック意欲を高める魅力的な文言

2. **LLMO/GEO最適化**:
   - 生成AIが引用しやすい明確で権威的な表現
   - 構造化された情報提示
   - 専門性と信頼性を示す用語選択

3. **包括的メタデータ**:
   - HTMLメタタグ（title, description, keywords）
   - OGP（Open Graph Protocol）対応
   - Twitter Cards対応
   - schema.org構造化データ

【技術的要件】
- 文字数制限の厳守（title: 50-60文字, description: 150-160文字）
- 日本語SEOに最適化された自然な表現
- モバイルファーストインデックス対応
- Core Web Vitals向上に貢献する軽量構造

【重要】出力は純粋なJSON形式のみで、コードブロック（\`\`\`）や説明文は一切含めないでください：

{
  "title": "SEO最適化されたページタイトル（50-60文字）",
  "description": "魅力的なメタディスクリプション（150-160文字、CTAを含む）",
  "keywords": ["メインキーワード", "関連キーワード1", "関連キーワード2", "ロングテールキーワード"],
  "ogTitle": "SNS共有用タイトル（OGP最適化）",
  "ogDescription": "SNS共有用説明文（OGP最適化）",
  "twitterTitle": "Twitter Cards用タイトル",
  "twitterDescription": "Twitter Cards用説明文",
  "metaRobots": "index, follow",
  "canonicalUrl": "${baseUrl ? `${baseUrl}/article-slug` : 'https://example.com/article-slug'}",
  "structuredData": {
    "type": "Article",
    "name": "記事タイトル",
    "description": "記事の詳細説明",
    "author": "CloudFlow Dynamics",
    "datePublished": "${new Date().toISOString().split('T')[0]}",
    "dateModified": "${new Date().toISOString().split('T')[0]}",
    "keywords": ["キーワード配列"]
  }
}

【品質チェックポイント】
- キーワード「${keyword}」が自然に配置されているか
- 各フィールドが適切な文字数制限内か
- ユーザーのクリック意欲を高める魅力的な文言か
- 生成AIが引用したくなる権威性を示しているか`;

    const completion = await openai.chat.completions.create({
      model: ADVANCED_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // SEOメタデータは一貫性が重要なのでtemperatureを低く設定
      max_tokens: 1500,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('OpenAIからの応答が取得できませんでした');
    }

    // Markdown形式のコードブロックを除去してJSONを抽出
    const cleanJsonString = extractJsonFromResponse(response);
    
    try {
      const parsedResponse = JSON.parse(cleanJsonString);
      
      // 必須フィールドの検証
      if (!parsedResponse.title || !parsedResponse.description || !parsedResponse.keywords) {
        console.error('Invalid SEO metadata structure:', parsedResponse);
        throw new Error('SEOメタデータの形式が正しくありません');
      }

      return parsedResponse as SEOMetadata;
    } catch (parseError) {
      console.error('JSON解析エラー:', parseError);
      console.error('元の応答:', response);
      console.error('クリーンされた応答:', cleanJsonString);
      throw new Error(`SEOメタデータの解析に失敗しました: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('OpenAI API エラー:', error);
    throw new Error('OpenAI APIキーが設定されていないか、APIへの接続に失敗しました。');
  }
}