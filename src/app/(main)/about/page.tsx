'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';


import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { PageContent } from '@/components/layout';
import { dependencies, devDependencies } from '../../../../package.json';

interface OpenSourceLibrary {
  name: string;
  version: string;
  license: string;
  description: string;
  url: string;
  category: string;
}

const openSourceLibraries: OpenSourceLibrary[] = [
  // 核心框架
  {
    name: 'React',
    version: dependencies.react,
    license: 'MIT',
    description: '用于构建用户界面的 JavaScript 库',
    url: 'https://react.dev',
    category: '核心框架',
  },
  {
    name: 'Next.js',
    version: dependencies.next,
    license: 'MIT',
    description: 'React 全栈应用框架，支持 SSR、SSG、API 路由',
    url: 'https://nextjs.org',
    category: '核心框架',
  },
  // 样式与UI
  {
    name: 'Tailwind CSS',
    version: devDependencies.tailwindcss,
    license: 'MIT',
    description: '实用优先的 CSS 框架，用于快速构建现代界面',
    url: 'https://tailwindcss.com',
    category: '样式与UI',
  },
  {
    name: 'Lucide',
    version: dependencies['lucide-react'],
    license: 'ISC',
    description: '开源图标库，提供精美的 SVG 图标',
    url: 'https://lucide.dev',
    category: '样式与UI',
  },
  {
    name: 'Radix UI',
    version: dependencies['@radix-ui/react-popover'],
    license: 'MIT',
    description: '无样式、可访问的 React UI 组件库',
    url: 'https://radix-ui.com',
    category: '样式与UI',
  },
  // 生物信息学
  {
    name: 'IGV.js',
    version: dependencies.igv,
    license: 'MIT',
    description: 'Integrative Genomics Viewer 的 JavaScript 版本，用于基因组数据可视化',
    url: 'https://igv.org',
    category: '生物信息学',
  },
  // 工具库
  {
    name: 'clsx',
    version: dependencies.clsx,
    license: 'MIT',
    description: '用于构建 className 字符串的小型工具',
    url: 'https://github.com/lukeed/clsx',
    category: '工具库',
  },
  {
    name: 'tailwind-merge',
    version: dependencies['tailwind-merge'],
    license: 'MIT',
    description: '用于合并 Tailwind CSS 类名而不产生冲突',
    url: 'https://github.com/dcastil/tailwind-merge',
    category: '工具库',
  },
  {
    name: 'mammoth.js',
    version: dependencies.mammoth,
    license: 'MIT',
    description: '用于解析 .docx 文件的 JavaScript 库',
    url: 'https://github.com/mwilliamson/mammoth.js',
    category: '工具库',
  },
  // 开发工具
  {
    name: 'TypeScript',
    version: devDependencies.typescript,
    license: 'Apache-2.0',
    description: 'JavaScript 的类型超集，提供静态类型检查',
    url: 'https://www.typescriptlang.org',
    category: '开发工具',
  },
  {
    name: 'PostCSS',
    version: devDependencies.postcss,
    license: 'MIT',
    description: '用 JavaScript 转换 CSS 的工具',
    url: 'https://postcss.org',
    category: '开发工具',
  },
];

const licenseColors: Record<string, string> = {
  MIT: 'bg-success-subtle text-success-fg border-success-muted',
  ISC: 'bg-accent-subtle text-accent-fg border-accent-muted',
  Apache: 'bg-warning-subtle text-warning-fg border-warning-muted',
  'Apache-2.0': 'bg-warning-subtle text-warning-fg border-warning-muted',
};

function LicenseBadge({ license }: { license: string }) {
  const colorClass = licenseColors[license] || 'bg-canvas-subtle text-fg-muted border-border-default';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {license}
    </span>
  );
}

export default function AboutPage() {
  const t = useText();
  // 按类别分组
  const groupedLibraries = openSourceLibraries.reduce((acc, lib) => {
    if (!acc[lib.category]) acc[lib.category] = [];
    acc[lib.category].push(lib);
    return acc;
  }, {} as Record<string, OpenSourceLibrary[]>);

  const categoryOrder = [t("about.coreFrameworks661227"), t("about.stylesAndUi887da0"), t("about.bioinformaticse61d5c"), t("about.utilitiesb60aef"), t("about.developmentToolsac1367")];

  return (
    <PageContent className="yj-page-shell">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="w-12 h-12 flex shrink-0 items-center justify-center overflow-hidden">
            <Image
              src="/logo.svg"
              alt={t("common.appName")}
              width={48}
              height={48}
              className="object-contain"
            />
          </div>
          <div><h1 className="yj-page-title mb-1">{t("about.openSourceSoftwareNotices356ef8")}</h1>
          <p className="text-sm text-fg-muted">{t("about.dependenciesVersionConstraintsAndLicenses25ed5e")}</p></div>
        </div>

        {/* Apache 2.0 许可证说明 */}
        <div className="mb-4 yj-panel p-5">
          <h2 className="text-sm font-medium text-fg-default mb-2">{t("about.projectLicense541cb1")}</h2>
          <p className="text-sm text-fg-muted leading-relaxed">
            {t("about.yijianIsReleasedUnderThec970e2")}<span className="font-medium text-fg-default">Apache License 2.0</span> {t("about.openSourceLicenseYouMayUseModify2b84e6")}</p>
        </div>

        {/* 第三方开源库 */}
        <div className="space-y-4">
          {categoryOrder.map(category => {
            const libs = groupedLibraries[category];
            if (!libs) return null;
            return (
              <section key={category} className="yj-panel p-5">
                <h2 className="text-sm font-medium text-fg-default mb-4">{category}</h2>
                <div className="divide-y divide-border-default">
                  {libs.map(lib => (
                    <div
                      key={lib.name}
                      className="flex flex-wrap items-start justify-between gap-3 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-medium text-fg-default">{lib.name}</span>
                          <LicenseBadge license={lib.license} />
                        </div>
                        <p className="text-sm text-fg-muted leading-relaxed">{translateUI(lib.description, t)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-xs text-fg-muted font-mono">{lib.version}</span>
                        {lib.name === 'Lucide' && <a href="/licenses/lucide.txt" target="_blank" rel="noopener noreferrer" className="text-xs text-accent-fg hover:underline">{t("about.fullCopyrightAndLicenseTextb2a167")}</a>}
                        <a
                          href={lib.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent-fg hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {t("about.website7c6748")}</a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* 许可证说明 */}
        <section className="mt-6 yj-panel p-5">
          <h2 className="text-sm font-medium text-fg-default mb-3">{t("about.licenseTypesa9437c")}</h2>
          <div className="space-y-2 text-sm text-fg-muted">
            <div className="flex items-start gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${licenseColors['MIT']}`}>MIT</span>
              <p>{t("about.permissiveLicenseAllowingUseModificationAndDistributionbfc8a2")}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${licenseColors['Apache-2.0']}`}>Apache-2.0</span>
              <p>{t("about.similarToMitWithPatentProtectionRetaind5cbe8")}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${licenseColors['ISC']}`}>ISC</span>
              <p>{t("about.similarToMitWithShorterWordingdfd1c5")}</p>
            </div>
          </div>
        </section>

        {/* 致谢 */}
        <section className="mt-6 yj-panel p-5">
          <h2 className="text-sm font-medium text-fg-default mb-2">{t("about.acknowledgments4a19ec")}</h2>
          <p className="text-sm text-fg-muted leading-relaxed">
            {t("about.weThankTheOpenSourceContributorsWhose516c48")}</p>
        </section>
      </div>
    </PageContent>
  );
}
