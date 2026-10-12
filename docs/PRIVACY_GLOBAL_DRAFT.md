# 全球隐私政策修订稿 / Global privacy notice draft

状态：2026-10-12 研究与修订记录。下方为原始讨论草案；已根据用户确认在 `src/lib/privacy-policy.ts` 实现同版本中英文页面并完成部署，实际展示内容以该文件为准。部署记录见 `PRIVACY_DEPLOYMENT_20261012.md`。不能仅凭政策文字宣称符合全部国家的法律。

已确认：英文名称为 SchemaBio，隐私请求沿用 support@schemabio.com（页面支持部署级邮箱覆盖）；海外托管服务使用海外云厂商或腾讯云海外区域，不使用中国境内服务器。用户未提供地址，页面不编造地址。国内服务与海外服务分别说明，海外云不等同于欧盟云，也不自动排除跨境支持或 AI 传输。

尚需运营落实：实际云区域及接收方清单、AI 供应商和保存/训练约定、必要的 DPA/BAA/代表、权利请求流程及法定联系方式。无地址的信息不能作为“无需法定联系信息”的结论；适用法律要求的公司地址或代表信息仍需通过实际运营安排提供。

## 发布前需要核实的事实

- 运营主体沿用现页的“绳墨生物科技有限公司”；补充其正式英文名称、联系地址及可受理隐私权请求的联系方式。代码默认支持邮箱为 support@schemabio.com，不能据此认定已设立隐私请求渠道。
- 当前部署使用广州腾讯云 COS 和计算资源；海外服务是否仍使用该区域，以及网络代理、CDN、支持人员和 AI 供应商的所在地，需要形成实际的数据流和接收方清单。
- 核实 AI 供应商、接收字段、保存期限、再利用/训练约定和分包商；代码中的 OpenAI-compatible 接口不代表供应商必然为 OpenAI。现有 AI 请求可含临床诊断、表型和变异上下文。
- 数据中心按配置展示保留天数和到期时间；BAM 的七天期限由任务完成时间起算。核实清理开关、对象版本和备份生命周期后再承诺具体删除完成期限。
- 核实结果、账户、账务、审计和备份的保存表及删除申请流程。现页“账户删除 30 个工作日”“日志不超过 180 天”“备份 72 小时清除”尚不能由本次代码检查证明。
- 海外上线前核实 GDPR 第 3 条适用性、必要的欧盟代表/DPO、处理协议和跨境机制；美国须按客户、州及数据类型核实 HIPAA、州隐私与健康数据法律适用性。没有 BAA 和相应控制时，不应宣传支持 HIPAA 受保护健康信息。

## 中文草案

### 一、范围与处理角色

本政策说明绳墨生物科技有限公司在提供贻鉴托管服务时如何处理个人信息，适用于平台访问者、机构账户使用者及分析数据所涉及的个人。自行部署的实例由部署机构说明其处理安排；本政策适用于我们实际收到或处理的信息，不自动覆盖独立部署机构的全部活动。

对账户、安全、支持和业务管理信息，我们根据自身提供服务的需要确定处理目的与方式。对机构提交的样本、测序、临床和分析信息，我们通常按照机构的合法指示作为受托处理方提供服务；机构负责确定其适用法律下的合法处理依据、告知和必要授权。双方在具体活动中的角色由实际处理安排及协议确定。

阅读本政策或勾选登录页面不替代敏感个人信息、跨境提供或其他依法需要的单独同意，也不替代机构对受检者的告知与授权。服务使用条件和科研用途限制应在独立的服务条款中说明。

### 二、信息类别、来源和目的

我们可从使用者、其所属机构及服务运行过程中取得：账户和机构信息；样本编号、性别、年龄、诊断和 HPO 表型；上传文件、序列、变异、基因、报告及人工解读；任务、操作人、时间、审计、计费、支持和访问记录。遗传、医疗健康及部分未成年人信息可能属于敏感个人信息或特殊类别数据；样本化名不保证匿名。

这些信息用于认证和权限管理、机构协作、执行分析、展示和保存结果、生成报告、处理支持请求、计费、安全防护、审计及履行法定义务。请提交完成所需功能必要的信息，避免在文件名或自由文本中添加无关身份信息。科研和模型训练等新的用途需要另行确定合法依据及必要告知、授权。

### 三、处理依据与敏感数据

在适用的情况下，账户和服务管理处理可基于履行合同、法定义务或适用法律允许的合法利益；依赖同意时应允许依法撤回。机构提交的健康、遗传数据需要同时满足相应敏感数据条件。在中国，依适用法律履行必要性、告知、单独同意等要求；在 GDPR 适用时，同时满足第 6 条依据和第 9 条条件。伦理批准并非在所有情形下替代个人信息处理依据。

### 四、接收方、AI 与国际传输

必要的接收方可能包括机构内获授权人员，以及承担托管、存储、网络、安全、支持或 AI 功能的服务提供商。披露范围应限于约定目的，并通过适用的处理协议和访问控制管理；法律要求的披露按合法程序处理。公共注释数据库的引用与向外部接口提交数据是不同活动，应按实际调用方式说明。

AI 辅助功能应在使用前说明供应商、接收的数据类别、用途、保存安排及适用的授权要求。不得在未核实供应商合同和配置前承诺“任何数据绝不传给第三方”或“供应商绝不保存或训练”。AI 结果需专业人员核对；本政策不授权新增训练或独立研究用途。

海外用户连接中国部署可能涉及数据传入中国；海外访问、支持、网络代理或 AI 调用还可能涉及其他国际传输。上线前应明确区域、接收方和保护机制。GDPR 适用时依法采用适当跨境机制（例如适用的标准合同条款及必要的传输评估和补充措施）；中国数据出境须按适用规定确定告知、单独同意、评估、合同或认证等要求及例外。不得以阅读本政策代替这些程序。

### 五、数据保留与删除策略

上传数据按数据中心显示的适用保留期限和到期时间管理；当前七天策略与文件类型、部署配置有关。分析产生的 BAM 当前自任务完成起保留七天。长期保存的 BED、分析结果、报告和审计记录应分别说明期限或决定期限的标准，不统一归入“全部文件七天删除”。

我们按服务需要、机构指示及适用的法律保存义务确定其他信息的保留期限。删除申请应覆盖生产数据、适用的接收方及备份安排；因账务、争议或法律义务需要保留的部分应限制其他使用并说明原因。备份清除按核实后的生命周期说明，不承诺尚未验证的固定完成时限。请在到期前依法保存所需资料；机构或用户已下载的副本由相应持有人管理。

### 六、安全、Cookie 与浏览器处理

我们采用与风险相称的认证、权限、传输保护、组织隔离和审计措施；不能将代码支持的功能等同于所有部署均启用的加密或安全保证。发生安全事件时，按适用法律和合同履行调查、补救和通知义务。

浏览器使用认证、CSRF 防护等必要 Cookie 及设置存储；部分查询和导出在浏览器内计算，不改变此前获取数据的服务端处理。新增非必要分析或广告技术前应更新告知及适用的选择机制。

### 七、权利、请求与未成年人

依适用法律及其例外，个人可请求访问或复制、更正、删除、限制处理、反对处理、可携带副本，以及撤回同意；撤回不影响此前合法处理。可通过经核实的隐私联系渠道提出请求，我们适度验证身份，按法定期限回复，不因依法行使权利而歧视。机构控制的样本数据请求通常需由机构处理，我们依约协助；法律保留要求和他人权利可能限制部分请求。

GDPR 适用时，可向有管辖权的监管机构投诉；一般在一个月内答复，符合法定条件的延期应告知。加州及其他州居民享有其适用法律规定的权利、代理请求及必要的申诉渠道；出售、跨情境广告共享、敏感信息限制和 opt-out preference signals 应按实际活动与法律适用性说明。不得用通用隐私声明替代适用的独立消费者健康数据政策。

平台面向专业机构及获授权人员。处理未成年人数据须按适用法律取得必要授权、实施保护并遵守机构伦理要求；在中国涉及不满十四周岁儿童个人信息时适用专门规则。处理美国 HIPAA 范围内的信息时须事先落实适用的 BAA 和保护措施；本政策不是 HIPAA 合规证明。

### 八、变更与联系

我们会标注实际生效日期并通知影响较大的变更；处理目的、方式或类别发生依法需要新授权的变更时，履行相应程序，不能仅以继续使用视作同意。本政策不排除适用地区的强制性隐私权和救济。运营主体、联系地址、隐私渠道和必要代表信息须在发布前补齐。

## English draft

### 1. Scope and roles

This notice describes how 绳墨生物科技有限公司 processes personal information when providing the hosted YiJian service. It covers visitors, institutional account users, and individuals whose information is included in analysis data. Independently deployed instances are operated by their deploying institutions; this notice covers information we actually receive or process.

We determine the purposes and means of processing account, security, support and business administration information for our service. For sample, sequencing, clinical and analysis information submitted by an institution, we generally act on that institution's lawful instructions as a processor. The institution determines its lawful basis, notices and required authorizations. Actual activities and agreements determine the parties' roles.

Reading this notice or checking a login box does not replace separate consent or other authorization required for sensitive information, international transfers or other activities. Service conditions and research-use limitations belong in separate service terms.

### 2. Information, sources and purposes

We may receive from users, their institutions and service operations: account and organization details; sample identifiers, sex, age, diagnoses and HPO terms; uploaded files, sequences, variants, genes, reports and interpretations; and task, operator, timestamp, audit, billing, support and access records. Genetic and health information, and certain children's information, may be sensitive or special-category data. Pseudonymous sample identifiers do not guarantee anonymity.

We use this information for authentication, access control, collaboration, analysis, result storage and display, reports, support, billing, security, auditing and legal obligations. Submit only what the requested function needs and avoid unnecessary identifying details in filenames or free text. New research or model-training purposes require their own lawful basis and any required notices and authorizations.

### 3. Legal bases and sensitive information

Where applicable, account and service administration may rely on contract performance, legal obligations or legitimate interests permitted by law. Where processing relies on consent, withdrawal must be available as required by law. Health and genetic information also requires an applicable sensitive-data condition. Chinese requirements may include necessity, specific notice and separate consent. Where GDPR applies, both an Article 6 basis and an Article 9 condition are required. Ethics approval does not universally replace a data-protection legal basis.

### 4. Recipients, AI and international transfers

Necessary recipients may include authorized institutional personnel and providers of hosting, storage, networking, security, support or AI services. Disclosures should be limited to agreed purposes and governed by applicable processing agreements and access controls. Legally required disclosures follow lawful procedures. Referencing public annotation databases differs from transmitting information to an external API and must be described according to actual operation.

Before AI assistance is used, its provider, input categories, purposes, retention arrangements and required authorizations should be disclosed. Do not promise that information never reaches third parties or that a provider never retains or trains on it without verifying contracts and settings. AI outputs require professional review. This notice does not authorize new training or independent research purposes.

Overseas users accessing a Chinese deployment may transfer information into China. Remote access, support, network intermediaries and AI calls may involve further international transfers. Deployment regions, recipients and safeguards must be identified before launch. Where GDPR applies, implement an appropriate transfer mechanism, such as applicable Standard Contractual Clauses with necessary transfer assessments and supplementary measures. For transfers from China, determine applicable notice, separate consent, assessment, contractual or certification requirements and exemptions. Reading this notice does not replace those procedures.

### 5. Retention and deletion

Uploaded data is managed according to the applicable retention period and expiry shown in the data center; the current seven-day policy depends on file type and deployment configuration. Analysis-generated BAM files currently have a seven-day retention period starting at task completion. Long-term BED files, analysis results, reports and audit records need separate periods or retention criteria; a single seven-day rule does not cover all files.

Other retention periods depend on service needs, institutional instructions and applicable legal obligations. Deletion requests should address production data, relevant recipients and backups. Information retained for accounting, disputes or legal obligations should have other uses restricted and the reason explained. Describe verified backup lifecycles rather than unverified fixed deletion deadlines. Keep necessary records lawfully before expiry; downloaded copies are managed by their respective holders.

### 6. Security, cookies and browser processing

We use risk-appropriate authentication, permissions, transport protection, organization separation and auditing. Software capabilities do not prove that every deployment enables all encryption or security controls. Security incidents are investigated, mitigated and notified as required by applicable law and contracts.

The browser uses necessary authentication and CSRF-protection cookies and settings storage. Some queries and exports run in the browser; this does not remove the server processing involved in obtaining the data. Introducing non-essential analytics or advertising technology requires updated disclosures and applicable choices.

### 7. Rights, requests and children

Subject to applicable law and exceptions, individuals may request access or copies, correction, deletion, restriction, objection, portability and withdrawal of consent. Withdrawal does not affect earlier lawful processing. Requests may be submitted through the verified privacy contact. We verify identity proportionately, respond within applicable statutory periods and do not discriminate for exercising lawful rights. Institutions generally handle requests concerning data they control, with our contractual assistance. Legal retention duties and others' rights may limit requests.

Where GDPR applies, individuals may complain to a competent supervisory authority; requests are generally answered within one month, with notice of any lawful extension. California and other state residents have the rights, authorized-agent procedures and required appeal channels provided by applicable laws. Disclosures about sale, cross-context advertising sharing, sensitive-information limits and opt-out preference signals must reflect actual activities and applicability. A general notice does not replace a distinct consumer health data policy where required.

The platform serves professional institutions and authorized users. Processing children's data requires applicable authorizations, protections and institutional ethics requirements, including special rules for children under fourteen in China. Before processing information subject to HIPAA, applicable Business Associate Agreements and safeguards must be in place. This notice is not a HIPAA compliance certification.

### 8. Changes and contact

We will state the actual effective date and notify material changes. Changes requiring a new authorization follow the applicable procedure; continued use alone does not replace that authorization. This notice does not exclude mandatory regional privacy rights or remedies. Operator details, contact address, privacy channel and any required representative details must be completed before publication.

## 法规参考与实施核对

- [中国《个人信息保护法》](https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm)：核对告知、受托处理、敏感信息、跨境和个人权利；政策文字不替代独立程序。
- [网信办跨境流动规定说明](https://www.cac.gov.cn/2024-03/22/c_1712776611649184.htm)：具体机制需结合实际流向、类型、数量及适用例外确定。
- [GDPR 法规原文](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)：核对第 3、6、9、12–22、27–28、32–35、37 和 44–49 条；完成适用性、角色、权利和跨境安排评估。
- [California AG CCPA](https://oag.ca.gov/privacy/ccpa)：核对适用门槛、告知、敏感信息和消费者权利；加州要求不能替代全美州法分析。
- [HHS HIPAA cloud guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html)：核实适用关系及 BAA，不做未经验证的 HIPAA 宣传。
- [Washington AG health-data guidance](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy)：适用时准备独立的消费者健康数据政策、相关选择和删除流程。

后续页面实现：提供中文 / English 切换和可分享的语言链接；两版同版本、同生效日期；第五条保留琥珀色浅色/深色样式；登录链接准确标为隐私政策，所需单独授权在对应数据处理入口实现。完成事实确认后再把草案改为正式告知文本，不能直接将本文件中的实施核对措辞当作已落实的运营承诺。
