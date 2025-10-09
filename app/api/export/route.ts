import { NextRequest, NextResponse } from 'next/server';

interface ExportRequest {
  format: 'markdown' | 'html';
  article: {
    title: string;
    sections: {
      heading: string;
      content: string;
      subheadings?: { title: string; content: string }[];
    }[];
    seoMetadata?: any;
  };
  options?: {
    includeSEO?: boolean;
    includeStyles?: boolean;
    filename?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { format, article, options = {} } = await request.json() as ExportRequest;

    if (!format || !article) {
      return NextResponse.json(
        { error: 'フォーマットと記事データが必要です' },
        { status: 400 }
      );
    }

    let exportedContent: string;
    let mimeType: string;
    let filename: string;

    switch (format) {
      case 'markdown':
        exportedContent = generateMarkdown(article, options);
        mimeType = 'text/markdown';
        filename = options.filename || 'article.md';
        break;
      case 'html':
        exportedContent = generateHTML(article, options);
        mimeType = 'text/html';
        filename = options.filename || 'article.html';
        break;
      default:
        return NextResponse.json(
          { error: 'サポートされていないフォーマットです' },
          { status: 400 }
        );
    }

    return new NextResponse(exportedContent, {
      headers: {
        'Content-Type': mimeType + '; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('エクスポートエラー:', error);
    return NextResponse.json(
      { error: 'エクスポートに失敗しました' },
      { status: 500 }
    );
  }
}

function generateMarkdown(article: any, options: any): string {
  let markdown = '';

  // Front Matter（SEOメタデータを含む）
  if (options.includeSEO && article.seoMetadata) {
    markdown += '---\n';
    markdown += `title: "${article.seoMetadata.title}"\n`;
    markdown += `description: "${article.seoMetadata.description}"\n`;
    markdown += `keywords: [${article.seoMetadata.keywords.map((k: string) => `"${k}"`).join(', ')}]\n`;
    markdown += `robots: "${article.seoMetadata.metaRobots}"\n`;
    if (article.seoMetadata.canonicalUrl) {
      markdown += `canonical: "${article.seoMetadata.canonicalUrl}"\n`;
    }
    markdown += `date: "${new Date().toISOString().split('T')[0]}"\n`;
    markdown += `author: "CloudFlow Dynamics"\n`;
    
    // OGP metadata
    markdown += `og:\n`;
    markdown += `  title: "${article.seoMetadata.ogTitle}"\n`;
    markdown += `  description: "${article.seoMetadata.ogDescription}"\n`;
    markdown += `  type: "article"\n`;
    
    // Twitter metadata
    markdown += `twitter:\n`;
    markdown += `  title: "${article.seoMetadata.twitterTitle}"\n`;
    markdown += `  description: "${article.seoMetadata.twitterDescription}"\n`;
    markdown += `  card: "summary_large_image"\n`;
    
    markdown += '---\n\n';
  }

  // Article title
  markdown += `# ${article.title}\n\n`;

  // Article sections
  article.sections.forEach((section: any) => {
    markdown += `## ${section.heading}\n\n`;
    markdown += `${section.content}\n\n`;

    if (section.subheadings) {
      section.subheadings.forEach((sub: any) => {
        markdown += `### ${sub.title}\n\n`;
        markdown += `${sub.content}\n\n`;
      });
    }
  });

  // Footer
  markdown += '---\n\n';
  markdown += `*この記事は [LLMO コンテンツ生成システム](https://github.com/ukenn2112/llmo-content) により自動生成されました。*\n`;
  markdown += `*生成日: ${new Date().toLocaleDateString('ja-JP')}*\n`;

  return markdown;
}

function generateHTML(article: any, options: any): string {
  const includeStyles = options.includeStyles !== false; // デフォルトでスタイルを含む
  
  let html = '<!DOCTYPE html>\n<html lang="ja">\n<head>\n';
  html += '  <meta charset="UTF-8">\n';
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';

  // SEOメタデータ
  if (options.includeSEO && article.seoMetadata) {
    const seo = article.seoMetadata;
    html += `  <title>${escapeHtml(seo.title)}</title>\n`;
    html += `  <meta name="description" content="${escapeHtml(seo.description)}">\n`;
    html += `  <meta name="keywords" content="${escapeHtml(seo.keywords.join(', '))}">\n`;
    html += `  <meta name="robots" content="${escapeHtml(seo.metaRobots)}">\n`;
    
    if (seo.canonicalUrl) {
      html += `  <link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}">\n`;
    }

    // OGP
    html += `  <meta property="og:title" content="${escapeHtml(seo.ogTitle)}">\n`;
    html += `  <meta property="og:description" content="${escapeHtml(seo.ogDescription)}">\n`;
    html += `  <meta property="og:type" content="article">\n`;
    if (seo.canonicalUrl) {
      html += `  <meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}">\n`;
    }

    // Twitter Cards
    html += `  <meta name="twitter:card" content="summary_large_image">\n`;
    html += `  <meta name="twitter:title" content="${escapeHtml(seo.twitterTitle)}">\n`;
    html += `  <meta name="twitter:description" content="${escapeHtml(seo.twitterDescription)}">\n`;

    // 構造化データ
    if (seo.structuredData) {
      html += '  <script type="application/ld+json">\n';
      html += `  ${JSON.stringify(seo.structuredData, null, 2)}\n`;
      html += '  </script>\n';
    }
  } else {
    html += `  <title>${escapeHtml(article.title)}</title>\n`;
  }

  // スタイル
  if (includeStyles) {
    html += `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
      background-color: #fff;
    }
    
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    
    h2 {
      color: #34495e;
      margin-top: 40px;
      margin-bottom: 20px;
      padding-left: 10px;
      border-left: 4px solid #3498db;
    }
    
    h3 {
      color: #7f8c8d;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    
    p {
      margin-bottom: 16px;
      text-align: justify;
    }
    
    .section {
      margin-bottom: 40px;
    }
    
    .subsection {
      margin-left: 20px;
      margin-bottom: 25px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border-left: 3px solid #28a745;
    }
    
    .footer {
      margin-top: 60px;
      padding: 20px;
      background-color: #ecf0f1;
      border-radius: 8px;
      text-align: center;
      color: #7f8c8d;
      font-size: 14px;
    }
    
    .meta-info {
      background-color: #e3f2fd;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid #2196f3;
    }
    
    .meta-info h4 {
      margin: 0 0 10px 0;
      color: #1976d2;
    }
    
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }
      
      .subsection {
        margin-left: 10px;
      }
    }
    
    @media print {
      body {
        background-color: white;
      }
      
      .footer {
        background-color: white;
        border: 1px solid #ddd;
      }
    }
  </style>
`;
  }

  html += '</head>\n<body>\n';

  // メタ情報
  if (options.includeSEO && article.seoMetadata) {
    html += '  <div class="meta-info">\n';
    html += '    <h4>📊 記事情報</h4>\n';
    html += `    <p><strong>生成日:</strong> ${new Date().toLocaleDateString('ja-JP')}</p>\n`;
    html += `    <p><strong>生成システム:</strong> LLMO コンテンツ生成システム (CloudFlow Dynamics)</p>\n`;
    html += `    <p><strong>最適化:</strong> SEO + LLMO/GEO統合最適化</p>\n`;
    html += '  </div>\n';
  }

  // Article title
  html += `  <h1>${escapeHtml(article.title)}</h1>\n\n`;

  // Article sections
  article.sections.forEach((section: any) => {
    html += '  <div class="section">\n';
    html += `    <h2>${escapeHtml(section.heading)}</h2>\n`;
    html += `    <p>${escapeHtml(section.content).replace(/\n/g, '</p>\n    <p>')}</p>\n`;

    if (section.subheadings) {
      section.subheadings.forEach((sub: any) => {
        html += '    <div class="subsection">\n';
        html += `      <h3>${escapeHtml(sub.title)}</h3>\n`;
        html += `      <p>${escapeHtml(sub.content).replace(/\n/g, '</p>\n      <p>')}</p>\n`;
        html += '    </div>\n';
      });
    }
    html += '  </div>\n\n';
  });

  // Footer
  html += '  <div class="footer">\n';
  html += '    <p>🤖 <strong>この記事はAIにより自動生成されました</strong></p>\n';
  html += '    <p><em>LLMO コンテンツ生成システム</em> - CloudFlow Dynamics</p>\n';
  html += `    <p>生成日: ${new Date().toLocaleDateString('ja-JP')} ${new Date().toLocaleTimeString('ja-JP')}</p>\n`;
  html += '  </div>\n';

  html += '</body>\n</html>';

  return html;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}