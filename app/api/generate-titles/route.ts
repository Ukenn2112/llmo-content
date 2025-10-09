import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai';

interface GeneratedTitle {
  id: string;
  title: string;
  description: string;
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
    const { keyword, overview } = await request.json();

    if (!keyword) {
      return NextResponse.json(
        { error: 'キーワードが必要です' },
        { status: 400 }
      );
    }

    // OpenAI APIを使用したLLMO最適化タイトル生成
    const titles: GeneratedTitle[] = await generateOptimizedTitlesWithAI(keyword, overview);

    return NextResponse.json({ titles });
  } catch (error) {
    console.error('タイトル生成エラー:', error);
    return NextResponse.json(
      { error: 'タイトル生成に失敗しました' },
      { status: 500 }
    );
  }
}

async function generateOptimizedTitlesWithAI(keyword: string, overview?: string): Promise<GeneratedTitle[]> {
  try {
    const systemPrompt = `あなたは生成式引擎優化（GEO）とLLMO（Large Language Model Optimization）の専門家です。
ChatGPT、Claude、Gemini等の大型語言模型に引用される可能性を最大化するブログタイトルを生成してください。

【E-E-A-T原則に基づくタイトル設計】
以下の4つの要素を必ず反映させてください：

**Experience（経験）**: 第一手経験や実践的知見を示唆
**Expertise（専門性）**: 専門知識や技術的深度を表現  
**Authoritativeness（権威性）**: 業界標準や規範的情報源としての地位
**Trustworthiness（可信度）**: 検証可能性と透明性を暗示

【RAG最適化戦略】
AIシステムが検索・引用する際の技術的要件：
1. **語義明確性**: 代名詞や曖昧な表現を避け、具体的な名詞を使用
2. **独立性**: タイトル単体で意味が完結し、文脈に依存しない
3. **構造化情報**: 数値・手順・分類などの構造化された知識を示唆
4. **問題解決型**: 具体的なペインポイントと解決策を明示

【生成要件】
- 8-10個のタイトルを生成
- 各タイトルに「なぜLLMO最適化されているか」の戦略的説明を付与
- 長尾キーワードと対話式クエリを意識した自然言語表現
- AI Agent（自律型AIシステム）による情報収集にも対応`;

    const userPrompt = `【ターゲットキーワード】: ${keyword}
${overview ? `【コンテキスト情報】: ${overview}` : ''}

【タスク】
上記情報に基づき、RAG（検索拡張生成）システムで優先的に検索・引用されるタイトルを生成してください。

【E-E-A-T最適化要件】
各タイトルは以下を明示的に含むこと：
- **経験の証明**: 「実践検証」「実装事例」「現場での」などの表現
- **専門性の表現**: 専門用語、技術的詳細度の適切な使用
- **権威性の暗示**: 「完全ガイド」「標準手法」「ベストプラクティス」
- **信頼性の担保**: 具体的数値、期間、成果指標の含有

【機械可読性最適化】
- 主語・述語を明確にし、代名詞を排除
- 一つのタイトルで一つの明確なコンセプトを表現
- AI分析しやすい構造化された情報パターンを採用

【対象クエリタイプ】
- 対話式質問（「○○するにはどうすれば？」）
- 比較検索（「○○と△△の違い」）  
- 実装指南（「○○の導入手順」）
- トラブルシューティング（「○○が失敗する理由」）

【重要】出力は純粋なJSON形式のみで、コードブロック（\`\`\`）や説明文は一切含めないでください：

{
  "titles": [
    {
      "title": "具体的なタイトル（40-60文字推奨）",
      "description": "このタイトルがE-E-A-T最適化とRAG検索で高評価を得る理由（150-200文字）"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('OpenAIからの応答が取得できませんでした');
    }

    // Markdown形式のコードブロックを除去してJSONを抽出
    const cleanJsonString = extractJsonFromResponse(response);
    
    try {
      const parsedResponse = JSON.parse(cleanJsonString);
      
      if (!parsedResponse.titles || !Array.isArray(parsedResponse.titles)) {
        console.error('Invalid response structure:', parsedResponse);
        throw new Error('応答の形式が正しくありません');
      }

      const generatedTitles: GeneratedTitle[] = parsedResponse.titles.map((title: any, index: number) => ({
        id: 'ai-title-' + (index + 1),
        title: title.title,
        description: title.description
      }));

      return generatedTitles;
    } catch (parseError) {
      console.error('JSON解析エラー:', parseError);
      console.error('元の応答:', response);
      console.error('クリーンされた応答:', cleanJsonString);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      throw new Error('応答の解析に失敗しました: ' + errorMessage);
    }
  } catch (error) {
    console.error('OpenAI API エラー:', error);
    throw new Error('OpenAI APIキーが設定されていないか、APIへの接続に失敗しました。');
  }
}