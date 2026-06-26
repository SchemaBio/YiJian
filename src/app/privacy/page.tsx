'use client';

import { Shield, ArrowLeft, Clock, Database, Lock, Eye, Trash2, Download, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas-default">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 返回登录 */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg-default transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          返回登录
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-fg-default mb-2">用户服务协议与隐私政策</h1>
          <p className="text-fg-muted text-sm">贻鉴遗传病胚系突变分析平台</p>
        </div>

        {/* 生效日期 */}
        <div className="flex items-center gap-4 text-xs text-fg-muted mb-8 px-4 py-3 bg-canvas-subtle rounded-lg border border-border">
          <span>发布日期：2026年6月26日</span>
          <span className="text-border">|</span>
          <span>生效日期：2026年6月26日</span>
        </div>

        {/* 重要声明 */}
        <div className="mb-8 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800 mb-1">特别提示</h3>
              <p className="text-sm text-red-700 leading-relaxed">
                本平台处理人类遗传资源数据，请确保您的使用符合《中华人民共和国人类遗传资源管理条例》及相关法律法规要求。
                使用本平台即表示您已充分阅读、理解并同意本协议的全部条款。
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* 第一条 定义与适用范围 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <span className="text-accent-fg">第一条</span> 定义与适用范围
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">1.1</strong> "本平台"指贻鉴遗传病胚系突变分析系统（以下简称"贻鉴"），由绳墨生物科技有限公司（以下简称"我们"）提供技术支持与运维服务。</p>
              <p><strong className="text-fg-default">1.2</strong> "用户"指注册并使用本平台的医疗机构、科研院所及其授权人员（以下简称"您"）。</p>
              <p><strong className="text-fg-default">1.3</strong> "原始测序数据"指用户上传的 FASTQ、BAM、VCF 等基因测序原始文件。</p>
              <p><strong className="text-fg-default">1.4</strong> "分析结果"指本平台基于用户上传数据生成的变异检测、注释、分类等分析产物。</p>
              <p><strong className="text-fg-default">1.5</strong> 本协议适用于您对本平台的访问、注册、使用及数据处理的全部过程。</p>
            </div>
          </section>

          {/* 第二条 平台性质与使用限制 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <span className="text-accent-fg">第二条</span> 平台性质与使用限制
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">2.1</strong> 本平台<strong className="text-red-600">仅供科学研究使用，不作为临床诊断依据</strong>。任何基于本平台分析结果做出的医学决策，应由具有相应资质的专业人员独立判断。</p>
              <p><strong className="text-fg-default">2.2</strong> 平台输出结果仅作为研究参考，不构成医疗建议、诊断或治疗方案。</p>
              <p><strong className="text-fg-default">2.3</strong> 用户不得将本平台用于任何违法目的，不得上传非法获取的遗传数据。</p>
            </div>
          </section>

          {/* 第三条 数据收集范围 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <span className="text-accent-fg">第三条</span> 数据收集范围
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">3.1 账户信息：</strong>注册时收集的邮箱、姓名、所属机构等基本信息，用于身份验证和服务提供。</p>
              <p><strong className="text-fg-default">3.2 测序数据：</strong>用户主动上传的 FASTQ、BAM、VCF 等基因测序文件，用于执行分析任务。</p>
              <p><strong className="text-fg-default">3.3 临床信息：</strong>用户录入的临床诊断、HPO 表型术语等元数据，用于辅助变异解读。</p>
              <p><strong className="text-fg-default">3.4 使用日志：</strong>操作记录、任务状态、系统访问日志等，用于服务运维和质量保障。</p>
              <p><strong className="text-fg-default">3.5</strong> 我们不会主动收集用户的生物样本，也不会对上传数据进行二次测序或独立研究。</p>
            </div>
          </section>

          {/* 第四条 数据使用目的 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <span className="text-accent-fg">第四条</span> 数据使用目的
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">4.1</strong> 我们仅将用户数据用于以下目的：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>执行用户提交的基因组分析任务</li>
                <li>生成、存储和展示分析结果</li>
                <li>提供技术支持和故障排查</li>
                <li>保障系统安全和性能优化</li>
                <li>遵守法律法规要求</li>
              </ul>
              <p><strong className="text-fg-default">4.2</strong> 我们<strong className="text-fg-default">不会</strong>将用户数据用于以下目的：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>未经用户授权的科学研究或商业用途</li>
                <li>向第三方出售、共享或转让</li>
                <li>用于训练机器学习模型或人工智能系统</li>
                <li>用于广告推送或用户画像</li>
              </ul>
            </div>
          </section>

          {/* 第五条 数据保留与删除策略 */}
          <section className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h2 className="text-base font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>第五条 数据保留与删除策略</span>
            </h2>
            <div className="space-y-3 text-sm text-amber-800 leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-amber-900">5.1 原始测序数据：</strong>用户上传的原始测序文件（FASTQ/BAM 等），自上传完成之日起保留 <strong className="text-red-600">7 个自然日</strong>，到期后由系统自动永久删除，<strong className="text-red-600">不可恢复</strong>。请用户在删除前确认已完成所需分析。</p>
              <p><strong className="text-amber-900">5.2 分析结果：</strong>分析任务产生的结果数据（变异列表、注释、报告等）在用户账户存续期间保留，用户可随时手动删除。</p>
              <p><strong className="text-amber-900">5.3 账户信息：</strong>用户注册信息在账户存续期间保留。用户注销账户后，我们将在 30 个工作日内删除全部关联数据。</p>
              <p><strong className="text-amber-900">5.4 系统日志：</strong>操作日志和系统日志保留不超过 180 天，到期自动清理。</p>
              <p><strong className="text-amber-900">5.5 数据备份：</strong>为保障服务连续性，系统可能对分析结果进行备份。备份数据随主数据一同删除，删除操作完成后 72 小时内备份数据将被彻底清除。</p>
            </div>
          </section>

          {/* 第六条 数据安全措施 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-accent-fg" />
              <span>第六条 数据安全措施</span>
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">6.1</strong> 我们采取以下技术措施保障数据安全：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>全链路 HTTPS/TLS 加密传输</li>
                <li>服务端数据加密存储</li>
                <li>基于角色的访问控制（RBAC）</li>
                <li>操作审计日志记录</li>
                <li>定期安全漏洞扫描与修复</li>
              </ul>
              <p><strong className="text-fg-default">6.2</strong> 建议用户自行部署时采取额外安全措施：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>在本地或内网环境部署，避免公网暴露</li>
                <li>配置防火墙和网络隔离</li>
                <li>定期备份数据并制定灾难恢复预案</li>
                <li>限制系统访问权限，实行最小权限原则</li>
              </ul>
            </div>
          </section>

          {/* 第七条 用户权利 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-accent-fg" />
              <span>第七条 用户权利</span>
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">7.1 知情权：</strong>您有权了解我们对您数据的处理方式和保留策略。</p>
              <p><strong className="text-fg-default">7.2 访问权：</strong>您有权随时访问和查看您在本平台中的数据。</p>
              <p><strong className="text-fg-default">7.3 导出权：</strong>您有权导出您的分析结果数据。</p>
              <p><strong className="text-fg-default">7.4 删除权：</strong>您有权随时删除您的分析结果数据和账户信息。</p>
              <p><strong className="text-fg-default">7.5 更正权：</strong>您有权更正您的账户信息和元数据。</p>
              <p><strong className="text-fg-default">7.6</strong> 行使上述权利，请通过系统内功能操作或联系平台管理员。</p>
            </div>
          </section>

          {/* 第八条 用户责任与义务 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <span className="text-accent-fg">第八条</span> 用户责任与义务
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">8.1</strong> 用户应确保其上传数据的合法性，包括但不限于：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>已获得受检者的知情同意或伦理委员会批准</li>
                <li>遵守《个人信息保护法》《数据安全法》等数据保护法律</li>
                <li>遵守《人类遗传资源管理条例》及实施细则</li>
                <li>不上传非法获取或侵犯他人权益的遗传数据</li>
              </ul>
              <p><strong className="text-fg-default">8.2</strong> 用户应妥善保管账户信息，因账户泄露导致的数据安全问题由用户自行承担。</p>
              <p><strong className="text-fg-default">8.3</strong> 用户应遵守所在地区关于遗传数据的出口管制和国际合作审批要求。</p>
            </div>
          </section>

          {/* 第九条 服务提供方免责声明 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <span className="text-accent-fg">第九条</span> 服务提供方免责声明
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">9.1</strong> 本平台以"现状"和"现有"基础提供，不提供任何形式的明示或暗示担保，包括但不限于适销性、特定用途适用性及不侵权的担保。</p>
              <p><strong className="text-fg-default">9.2</strong> 我们不对以下情况承担责任：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>因使用本平台分析结果导致的任何直接或间接医疗决策后果</li>
                <li>分析结果的准确性、完整性、时效性或适用性</li>
                <li>用户违反法律法规或本协议导致的任何后果</li>
                <li>因不可抗力、网络故障、第三方服务中断导致的数据丢失或服务中断</li>
                <li>用户自行部署环境中的数据泄露或安全事件</li>
              </ul>
              <p><strong className="text-fg-default">9.3</strong> 用户理解并同意，基因组分析存在固有的不确定性和局限性，分析结果不应作为唯一的决策依据。</p>
            </div>
          </section>

          {/* 第十条 第三方服务与数据共享 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-accent-fg" />
              <span>第十条 第三方服务与数据共享</span>
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">10.1</strong> 本平台可能引用第三方公共数据库（如 gnomAD、ClinVar、OMIM 等）进行变异注释，此类引用不代表我们对第三方数据的准确性做出担保。</p>
              <p><strong className="text-fg-default">10.2</strong> 除法律法规要求或政府主管部门依法调取外，我们不会向任何第三方共享、出售或转让用户数据。</p>
              <p><strong className="text-fg-default">10.3</strong> 如因法律法规变更、司法程序或行政命令需要披露用户数据，我们将在法律允许的范围内提前通知用户。</p>
            </div>
          </section>

          {/* 第十一条 未成年人保护 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <span className="text-accent-fg">第十一条</span> 未成年人保护
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">11.1</strong> 本平台面向具有完全民事行为能力的专业人员，不面向未成年人提供服务。</p>
              <p><strong className="text-fg-default">11.2</strong> 如涉及未成年人遗传数据的分析，用户应确保已获得其法定监护人的知情同意，并符合伦理审查要求。</p>
            </div>
          </section>

          {/* 第十二条 协议修订 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <span className="text-accent-fg">第十二条</span> 协议修订
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">12.1</strong> 我们有权根据法律法规变化和业务需要修订本协议。修订后的协议将在平台内公告。</p>
              <p><strong className="text-fg-default">12.2</strong> 重大条款变更（如数据保留策略、使用范围等）将提前 30 日通知用户。</p>
              <p><strong className="text-fg-default">12.3</strong> 用户在协议变更后继续使用本平台，视为同意变更后的协议。</p>
            </div>
          </section>

          {/* 第十三条 法律适用与争议解决 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <span className="text-accent-fg">第十三条</span> 法律适用与争议解决
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">13.1</strong> 本协议的签订、履行、解释及争议解决均适用中华人民共和国法律（不含港澳台地区法律）。</p>
              <p><strong className="text-fg-default">13.2</strong> 因本协议引起的或与本协议有关的任何争议，双方应首先协商解决；协商不成的，任何一方均有权向我们所在地有管辖权的人民法院提起诉讼。</p>
            </div>
          </section>

          {/* 第十四条 开源许可 */}
          <section>
            <h2 className="text-base font-semibold text-fg-default mb-3 flex items-center gap-2">
              <span className="text-accent-fg">第十四条</span> 开源许可
            </h2>
            <div className="space-y-3 text-sm text-fg-muted leading-relaxed pl-0 md:pl-6">
              <p><strong className="text-fg-default">14.1</strong> 本平台采用 Apache License 2.0 开源协议。用户可自由使用、修改和分发，但需保留原作者版权声明。</p>
              <p><strong className="text-fg-default">14.2</strong> 用户基于本平台二次开发的衍生作品，其合规性和法律责任由用户自行承担。</p>
            </div>
          </section>

          {/* 附录：适用法律法规 */}
          <section className="p-4 bg-canvas-subtle rounded-lg border border-border">
            <h2 className="text-sm font-medium text-fg-default mb-3">附录：本协议涉及的主要法律法规</h2>
            <ul className="text-xs text-fg-muted space-y-1.5 list-disc list-inside">
              <li>《中华人民共和国个人信息保护法》</li>
              <li>《中华人民共和国数据安全法》</li>
              <li>《中华人民共和国网络安全法》</li>
              <li>《中华人民共和国人类遗传资源管理条例》</li>
              <li>《中华人民共和国人类遗传资源管理条例实施细则》</li>
              <li>《个人信息出境标准合同办法》</li>
            </ul>
          </section>

          {/* Footer */}
          <div className="text-center text-xs text-fg-muted pt-6 border-t border-border">
            <p>绳墨生物科技有限公司</p>
            <p className="mt-1">本协议最后更新：2026年6月26日</p>
          </div>
        </div>
      </div>
    </div>
  );
}
