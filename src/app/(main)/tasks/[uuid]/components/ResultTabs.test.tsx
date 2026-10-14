import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultTabs } from './ResultTabs';
import { VariantTypeNav } from './VariantTypeNav';
import type { TabType } from '../types';

function Workspace() {
  const [activeTab, setActiveTab] = React.useState<TabType>('cnv-exon');
  return <ResultTabs activeTab={activeTab} onTabChange={setActiveTab}
    variantNavigation={<VariantTypeNav activeTab={activeTab} onTabChange={setActiveTab} context={null} />}>
    <p>当前内容：{activeTab}</p>
  </ResultTabs>;
}

describe('task workspace navigation', () => {
  it('keeps icon navigation and the selected variant available while collapsed', () => {
    render(<Workspace />);
    fireEvent.click(screen.getByRole('button', { name: '收起解读导航' }));
    expect(screen.getByRole('button', { name: '展开解读导航' })).toHaveAttribute('aria-expanded', 'false');
    const variants = screen.getByRole('navigation', { name: '变异类型' });
    fireEvent.click(within(variants).getByRole('button', { name: /MEI/ }));
    expect(screen.getByText('当前内容：mei')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '展开解读导航' }));
    expect(within(variants).getByRole('button', { name: /MEI/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '收起解读导航' })).toHaveAttribute('aria-expanded', 'true');
  });
  it('returns to the last variant type after visiting overview or files', () => {
    render(<Workspace />);
    const sections = screen.getByRole('navigation', { name: '分析结果标签页' });
    fireEvent.click(within(sections).getByRole('button', { name: '文件' }));
    expect(screen.queryByRole('navigation', { name: '变异类型' })).not.toBeInTheDocument();
    expect(screen.getByText('当前内容：files')).toBeInTheDocument();
    fireEvent.click(within(sections).getByRole('button', { name: '变异解读' }));
    expect(screen.getByText('当前内容：cnv-exon')).toBeInTheDocument();
    fireEvent.click(within(sections).getByRole('button', { name: '总览' }));
    fireEvent.click(within(sections).getByRole('button', { name: '变异解读' }));
    expect(screen.getByText('当前内容：cnv-exon')).toBeInTheDocument();
  });

  it('moves through variant types with the keyboard and labels the active section', () => {
    render(<Workspace />);
    const variants = screen.getByRole('navigation', { name: '变异类型' });
    fireEvent.keyDown(within(variants).getByRole('button', { name: /CNV\(Exon\)/ }), { key: 'ArrowDown' });
    expect(screen.getByText('当前内容：str')).toBeInTheDocument();
    expect(within(variants).getByRole('button', { name: /动态突变/ })).toHaveFocus();
    expect(within(variants).getByRole('button', { name: /动态突变/ })).toHaveAttribute('aria-current', 'page');
    fireEvent.keyDown(screen.getByRole('button', { name: '变异解读' }), { key: 'ArrowDown' });
    expect(screen.getByText('当前内容：files')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '文件' })).toBeInTheDocument();
  });
});
