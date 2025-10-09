"use client";

import { useState, useRef, useEffect } from "react";

interface GeneratedTitle {
  id: string;
  title: string;
  description: string;
}

interface SEOMetadata {
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

interface GeneratedArticle {
  title: string;
  sections: {
    heading: string;
    content: string;
    subheadings?: { title: string; content: string }[];
  }[];
  seoMetadata?: SEOMetadata;
}

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [overview, setOverview] = useState("");
  const [generatedTitles, setGeneratedTitles] = useState<GeneratedTitle[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<GeneratedTitle | null>(null);
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticle | null>(null);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [generateSEO, setGenerateSEO] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");

  // エクスポートメニューを外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const exportMenu = document.getElementById('export-menu');
      const exportButton = event.target as Element;
      if (exportMenu && !exportMenu.contains(exportButton) && !exportButton.closest('button[data-export-toggle]')) {
        exportMenu.classList.add('hidden');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // スクロール用のref
  const titlesResultRef = useRef<HTMLDivElement>(null);
  const articleResultRef = useRef<HTMLDivElement>(null);

  // エクスポート処理
  const handleExport = async (format: 'markdown' | 'html') => {
    if (!generatedArticle) return;

    try {
      const exportData = {
        format,
        article: generatedArticle,
        options: {
          includeSEO: !!generatedArticle.seoMetadata,
          includeStyles: format === 'html',
          filename: `${generatedArticle.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase()}.${format === 'markdown' ? 'md' : 'html'}`
        }
      };

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (response.ok) {
        // ファイルをダウンロード
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = exportData.options.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // 成功フィードバック
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fadeInUp';
        notification.textContent = `✅ ${format.toUpperCase()}ファイルをダウンロードしました`;
        document.body.appendChild(notification);
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
      } else {
        throw new Error('エクスポートに失敗しました');
      }
    } catch (error) {
      console.error('エクスポートエラー:', error);
      alert(`エクスポートに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const generateTitles = async () => {
    if (!keyword.trim()) return;
    
    setIsGeneratingTitles(true);
    setGeneratedTitles([]); // 既存のタイトルをクリア
    
    try {
      const response = await fetch('/api/generate-titles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword, overview }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setGeneratedTitles(data.titles);
        
        // タイトル生成完了後に自動スクロール
        setTimeout(() => {
          titlesResultRef.current?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }, 100);
      } else {
        const errorData = await response.json();
        alert(`タイトル生成に失敗しました: ${errorData.error || '不明なエラー'}\n\nOpenAI APIキーが正しく設定されているか確認してください。`);
      }
    } catch (error) {
      console.error('タイトル生成エラー:', error);
      alert('OpenAI APIへの接続でエラーが発生しました。\n\n.env.localファイルにOPENAI_API_KEYを設定してください。');
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  const generateArticle = async (title: GeneratedTitle) => {
    setSelectedTitle(title);
    setIsGeneratingArticle(true);
    setGeneratedArticle(null); // 既存の記事をクリア
    
    // 記事生成開始時に生成エリアへスクロール（少し遅延させる）
    setTimeout(() => {
      const generateSection = document.getElementById('article-generating-section');
      if (generateSection) {
        generateSection.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 300);
    
    try {
      const response = await fetch('/api/generate-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: title.title,
          description: title.description,
          keyword,
          overview,
          generateSEO,
          baseUrl: baseUrl.trim() || undefined
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setGeneratedArticle(data.article);
        
        // 記事生成完了後に自動スクロール（少し遅延させてアニメーションを楽しませる）
        setTimeout(() => {
          articleResultRef.current?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }, 300);
      } else {
        const errorData = await response.json();
        alert(`記事生成に失敗しました: ${errorData.error || '不明なエラー'}\n\nOpenAI APIキーが正しく設定されているか確認してください。`);
      }
    } catch (error) {
      console.error('記事生成エラー:', error);
      alert('OpenAI APIへの接続でエラーが発生しました。\n\n.env.localファイルにOPENAI_API_KEYを設定してください。');
    } finally {
      setIsGeneratingArticle(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            LLMO コンテンツ生成システム
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
            CloudFlow Dynamics
          </p>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            OpenAI GPTモデルによる高品質なLLMO最適化コンテンツ生成システム。ChatGPT、Claude、Geminiが参照したくなる記事を作成します。
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">OpenAI GPT-4o Powered</span>
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full">
              ⚠️ OpenAI APIキーが必要です
            </div>
          </div>
        </header>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8">
          <div className="space-y-6">
            <div>
              <label htmlFor="keyword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                メインキーワード <span className="text-red-500">*</span>
              </label>
              <input
                id="keyword"
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="例：プロジェクト管理、営業DX、リモートワークなど"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="overview" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                記事の概要・既存コンテンツ（任意）
              </label>
              <textarea
                id="overview"
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                placeholder="書きたい記事の概要や、既存のコンテンツがあれば入力してください..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    🎯 SEO最適化オプション
                    <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded-full font-medium">
                      NEW
                    </span>
                  </h3>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    記事と同時にSEOメタデータを自動生成します
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateSEO}
                    onChange={(e) => setGenerateSEO(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              {generateSEO && (
                <div className="space-y-3 animate-fadeInUp">
                  <div>
                    <label htmlFor="baseUrl" className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                      ベースURL（任意）
                    </label>
                    <input
                      id="baseUrl"
                      type="url"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://your-website.com"
                      className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-blue-900/30 dark:text-blue-100 bg-white/70"
                    />
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      カノニカルURL生成に使用されます
                    </p>
                  </div>
                  
                  <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100/50 dark:bg-blue-900/30 rounded-md p-2">
                    <div className="font-medium mb-1">✨ 生成される要素:</div>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div>• HTMLメタタグ</div>
                      <div>• OGPメタデータ</div>
                      <div>• Twitter Cards</div>
                      <div>• 構造化データ</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={generateTitles}
              disabled={!keyword.trim() || isGeneratingTitles || isGeneratingArticle}
              className="group relative w-full overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 disabled:from-gray-400 disabled:via-gray-500 disabled:to-gray-600 text-white font-bold py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {/* Background Animation */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
              
              {/* Icon */}
              {isGeneratingTitles ? (
                <div className="relative">
                  <div className="animate-spin rounded-full h-6 w-6 border-3 border-white/30"></div>
                  <div className="animate-spin rounded-full h-6 w-6 border-t-3 border-white absolute inset-0"></div>
                </div>
              ) : (
                <div className="text-xl group-hover:scale-110 transition-transform duration-200">
                  ✨
                </div>
              )}
              
              {/* Text */}
              <span className="relative z-10 text-base sm:text-lg tracking-wide">
                {isGeneratingTitles ? 'AIがタイトルを生成中...' : 'タイトル案を生成'}
              </span>
              
              {/* Shine Effect */}
              {!isGeneratingTitles && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
              )}
            </button>
          </div>
        </div>

        {/* タイトル生成中のアニメーション */}
        {isGeneratingTitles && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-600"></div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  OpenAI GPT-4o がタイトルを生成中...
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  LLMO最適化されたタイトル案を作成しています
                </p>
                <div className="mt-3 flex justify-center">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {generatedTitles.length > 0 && (
          <div ref={titlesResultRef} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8 animate-fadeInUp">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <span className="text-green-500">✨</span>
              生成されたタイトル案
            </h2>
            <div className="space-y-4">
              {generatedTitles.map((titleObj, index) => (
                <div
                  key={titleObj.id}
                  className={`group relative border border-gray-200 dark:border-gray-600 rounded-xl p-6 transition-all duration-300 transform backdrop-blur-sm ${
                    isGeneratingArticle 
                      ? 'opacity-50 cursor-not-allowed bg-gray-50/50 dark:bg-gray-800/50' 
                      : 'hover:border-blue-400 hover:shadow-2xl cursor-pointer hover:scale-[1.03] bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800'
                  }`}
                  onClick={() => !isGeneratingArticle && generateArticle(titleObj)}
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
                  }}
                >
                  {/* Hover indicator */}
                  {!isGeneratingArticle && (
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    </div>
                  )}
                  
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                    {titleObj.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    {titleObj.description}
                  </p>
                  <button 
                    className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                    disabled={isGeneratingArticle}
                  >
                    {isGeneratingArticle ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        生成中...
                      </>
                    ) : (
                      <>
                        <span>記事を生成</span>
                        <span>✨</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isGeneratingArticle && (
          <div id="article-generating-section" className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8 animate-fadeInUp">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-20 w-20 border-4 border-green-200 dark:border-green-800"></div>
                <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-green-600 absolute inset-0"></div>
                <div className="absolute inset-2 bg-gradient-to-r from-green-400 to-green-600 rounded-full animate-pulse opacity-30"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-green-600 text-2xl animate-pulse">✏️</div>
                </div>
              </div>
              <div className="text-center max-w-md">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 animate-pulse">
                  🤖 OpenAI GPT-4o が記事を執筆中...
                </h3>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-3">
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-1">
                    📝 選択されたタイトル:
                  </p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                    {selectedTitle?.title}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-500 dark:text-gray-400 text-xs animate-pulse">
                    🧠 LLMO最適化された構造を設計中...
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs animate-pulse" style={{animationDelay: '0.3s'}}>
                    🎯 E-E-A-T信号を組み込み中（経験・専門性・権威性・可信度）
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs animate-pulse" style={{animationDelay: '0.6s'}}>
                    🤖 RAG最適化設計を適用中（チャンキング対応・語義明確性）
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs animate-pulse" style={{animationDelay: '0.9s'}}>
                    📊 機械可読性を向上中（構造化データ・API型設計）
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs animate-pulse" style={{animationDelay: '1.2s'}}>
                    ✅ 可信度建立中（検証データ・透明性・権威引用）
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs animate-pulse" style={{animationDelay: '1.5s'}}>
                    🚀 GEO戦略実装中（実体構築・概念最適化）
                  </p>
                </div>
                {/* 关键实施要素进度指示器 */}
                <div className="mt-6 w-full max-w-sm mx-auto">
                  <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 text-center font-medium">
                    🔧 关键实施要素整合進度
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded-md p-2 text-center animate-pulse">
                      <div className="text-blue-600 text-xs font-medium">E-E-A-T</div>
                      <div className="text-blue-500 text-[10px]">権威性構築</div>
                    </div>
                    <div className="bg-purple-100 dark:bg-purple-900/30 rounded-md p-2 text-center animate-pulse" style={{animationDelay: '0.5s'}}>
                      <div className="text-purple-600 text-xs font-medium">RAG対応</div>
                      <div className="text-purple-500 text-[10px]">機械理解</div>
                    </div>
                    <div className="bg-orange-100 dark:bg-orange-900/30 rounded-md p-2 text-center animate-pulse" style={{animationDelay: '1s'}}>
                      <div className="text-orange-600 text-xs font-medium">GEO戦略</div>
                      <div className="text-orange-500 text-[10px]">実体最適化</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                    <div className="bg-gradient-to-r from-green-400 via-green-500 to-green-600 h-3 rounded-full animate-pulse shadow-lg">
                      <div className="h-full bg-white opacity-30 rounded-full animate-ping"></div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-center">
                  <div className="flex space-x-2">
                    {[...Array(6)].map((_, i) => (
                      <div 
                        key={i}
                        className="w-3 h-3 bg-gradient-to-r from-green-400 to-green-600 rounded-full animate-bounce shadow-sm" 
                        style={{animationDelay: `${i * 150}ms`}}
                      ></div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  ⏱️ 高品質な記事のため、少々お待ちください...
                </div>
                
                {/* 关键实施要素详细表格 */}
                <div className="mt-6 w-full max-w-2xl mx-auto">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 text-center">
                      📋 LLMO関键実施要素チェックリスト
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 animate-pulse">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                          <span className="text-gray-600 dark:text-gray-300">E-E-A-T権威性信号</span>
                        </div>
                        <div className="flex items-center gap-2 animate-pulse" style={{animationDelay: '0.3s'}}>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping"></div>
                          <span className="text-gray-600 dark:text-gray-300">RAG兼容性設計</span>
                        </div>
                        <div className="flex items-center gap-2 animate-pulse" style={{animationDelay: '0.6s'}}>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                          <span className="text-gray-600 dark:text-gray-300">語義明確性最適化</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 animate-pulse" style={{animationDelay: '0.9s'}}>
                          <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></div>
                          <span className="text-gray-600 dark:text-gray-300">構造化情報設計</span>
                        </div>
                        <div className="flex items-center gap-2 animate-pulse" style={{animationDelay: '1.2s'}}>
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                          <span className="text-gray-600 dark:text-gray-300">可信度建立機制</span>
                        </div>
                        <div className="flex items-center gap-2 animate-pulse" style={{animationDelay: '1.5s'}}>
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
                          <span className="text-gray-600 dark:text-gray-300">GEO戦略実装</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {generatedArticle && (
          <div ref={articleResultRef} className="space-y-6 animate-fadeInUp">
            {/* SEOメタデータセクション */}
            {generatedArticle.seoMetadata && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-lg p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <span className="text-blue-600">🎯</span>
                    SEOメタデータ
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const seo = generatedArticle.seoMetadata!;
                        const htmlMetaTags = `<!-- SEO メタタグ -->
<title>${seo.title}</title>
<meta name="description" content="${seo.description}">
<meta name="keywords" content="${seo.keywords.join(', ')}">
<meta name="robots" content="${seo.metaRobots}">
${seo.canonicalUrl ? `<link rel="canonical" href="${seo.canonicalUrl}">` : ''}

<!-- Open Graph メタタグ -->
<meta property="og:title" content="${seo.ogTitle}">
<meta property="og:description" content="${seo.ogDescription}">
<meta property="og:type" content="article">
${seo.canonicalUrl ? `<meta property="og:url" content="${seo.canonicalUrl}">` : ''}

<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${seo.twitterTitle}">
<meta name="twitter:description" content="${seo.twitterDescription}">

<!-- 構造化データ -->
<script type="application/ld+json">
${JSON.stringify(seo.structuredData, null, 2)}
</script>`;
                        navigator.clipboard.writeText(htmlMetaTags);
                        // コピー成功のフィードバック
                        const button = event?.target as HTMLButtonElement;
                        const originalHtml = button.innerHTML;
                        button.innerHTML = '✅ <span class="ml-1">コピー済み</span>';
                        setTimeout(() => {
                          button.innerHTML = originalHtml;
                        }, 2000);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-xs font-medium transition-colors duration-200 flex items-center gap-1"
                    >
                      📋 HTMLタグをコピー
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/50">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1">
                        <span className="text-green-600">🏷️</span>
                        HTMLメタタグ
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Title:</span>
                          <p className="text-gray-800 dark:text-gray-200 mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded">{generatedArticle.seoMetadata.title}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Description:</span>
                          <p className="text-gray-800 dark:text-gray-200 mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded">{generatedArticle.seoMetadata.description}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Keywords:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {generatedArticle.seoMetadata.keywords.map((kw, i) => (
                              <span key={i} className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-[10px]">{kw}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/50">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1">
                        <span className="text-purple-600">🔗</span>
                        SNS共有 (OGP)
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">OG Title:</span>
                          <p className="text-gray-800 dark:text-gray-200 mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded">{generatedArticle.seoMetadata.ogTitle}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">OG Description:</span>
                          <p className="text-gray-800 dark:text-gray-200 mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded">{generatedArticle.seoMetadata.ogDescription}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/50">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1">
                        <span className="text-cyan-600">🐦</span>
                        Twitter Cards
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Twitter Title:</span>
                          <p className="text-gray-800 dark:text-gray-200 mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded">{generatedArticle.seoMetadata.twitterTitle}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Twitter Description:</span>
                          <p className="text-gray-800 dark:text-gray-200 mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded">{generatedArticle.seoMetadata.twitterDescription}</p>
                        </div>
                      </div>
                    </div>

                    {generatedArticle.seoMetadata.structuredData && (
                      <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/50">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1">
                          <span className="text-orange-600">📊</span>
                          構造化データ
                        </h4>
                        <div className="text-xs">
                          <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono text-[10px] overflow-x-auto">
                            <pre>{JSON.stringify(generatedArticle.seoMetadata.structuredData, null, 2)}</pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 記事コンテンツセクション */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-green-500">🎉</span>
                  生成された記事
                </h2>
                <div className="flex gap-2">
                  <div className="relative">
                    <button
                      data-export-toggle
                      onClick={() => {
                        const exportMenu = document.getElementById('export-menu');
                        if (exportMenu) {
                          exportMenu.classList.toggle('hidden');
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                    >
                      📥 エクスポート
                      <span className="text-xs">▼</span>
                    </button>
                    <div id="export-menu" className="absolute right-0 top-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 hidden min-w-48">
                      <div className="p-2">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 px-2 py-1 mb-1">
                          📄 ファイル形式を選択
                        </div>
                        <button
                          onClick={async () => {
                            await handleExport('markdown');
                            document.getElementById('export-menu')?.classList.add('hidden');
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-2"
                        >
                          <span className="text-base">📝</span>
                          Markdown (.md)
                          <span className="ml-auto text-xs text-gray-500">Front Matter付き</span>
                        </button>
                        <button
                          onClick={async () => {
                            await handleExport('html');
                            document.getElementById('export-menu')?.classList.add('hidden');
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-2"
                        >
                          <span className="text-base">🌐</span>
                          HTML (.html)
                          <span className="ml-auto text-xs text-gray-500">スタイル付き</span>
                        </button>
                        <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                        <div className="px-2 py-1">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">含まれる要素:</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            <div>✓ 記事コンテンツ</div>
                            {generatedArticle.seoMetadata && <div>✓ SEOメタデータ</div>}
                            <div>✓ 生成情報</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `# ${generatedArticle.title}\n\n` +
                        generatedArticle.sections.map(section => 
                          `## ${section.heading}\n\n${section.content}\n\n` +
                          (section.subheadings?.map(sub => 
                            `### ${sub.title}\n\n${sub.content}\n\n`
                          ).join('') || '')
                        ).join('')
                      );
                      // コピー成功のフィードバック
                      const button = event?.target as HTMLButtonElement;
                      const originalHtml = button.innerHTML;
                      button.innerHTML = '✅ <span class="ml-1">コピー済み</span>';
                      button.className = button.className.replace('from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800', 'from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800');
                      setTimeout(() => {
                        button.innerHTML = originalHtml;
                        button.className = button.className.replace('from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800', 'from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800');
                      }, 2000);
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                  >
                    📋 記事をコピー
                  </button>
                </div>
              </div>
              
              <article className="prose prose-lg dark:prose-invert max-w-none">
                <h1 className="text-3xl font-bold mb-6 animate-fadeInUp">{generatedArticle.title}</h1>
                
                {generatedArticle.sections.map((section, index) => (
                  <section 
                    key={index} 
                    className="mb-8 animate-fadeInUp"
                    style={{animationDelay: `${index * 0.2}s`}}
                  >
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                      <span className="text-blue-500 text-xl">📋</span>
                      {section.heading}
                    </h2>
                    <div className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap leading-relaxed">
                      {section.content}
                    </div>
                    
                    {section.subheadings?.map((sub, subIndex) => (
                      <div 
                        key={subIndex} 
                        className="ml-4 mb-4 animate-fadeInUp border-l-4 border-blue-200 dark:border-blue-800 pl-4"
                        style={{animationDelay: `${(index * 0.2) + (subIndex * 0.1) + 0.1}s`}}
                      >
                        <h3 className="text-xl font-medium mb-2 flex items-center gap-2">
                          <span className="text-green-500 text-sm">▶️</span>
                          {sub.title}
                        </h3>
                        <div className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                          {sub.content}
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </article>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
