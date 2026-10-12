export type PrivacyLanguage = 'zh' | 'en';
type PolicyText = { title: string; paragraphs: readonly string[] };
type PolicySection = { id: string; zh: PolicyText; en: PolicyText };

export const privacySections: readonly PolicySection[] = [
  {
    "id": "scope",
    "zh": {
      "title": "第一条 范围与处理角色",
      "paragraphs": [
        "本政策说明绳墨生物科技有限公司（SchemaBio）在提供贻鉴托管服务时如何处理个人信息，适用于平台访问者、机构账户使用者及分析数据所涉及的个人。自行部署的实例由部署机构说明其处理安排；本政策适用于我们实际收到或处理的信息，不自动覆盖独立部署机构的全部活动。",
        "对账户、安全、支持和业务管理信息，我们根据自身提供服务的需要确定处理目的与方式。对机构提交的样本、测序、临床和分析信息，我们通常按照机构的合法指示作为受托处理方提供服务；机构负责确定其适用法律下的合法处理依据、告知和必要授权。双方在具体活动中的角色由实际处理安排及协议确定。",
        "阅读本政策或勾选登录页面不替代敏感个人信息、跨境提供或其他依法需要的单独同意，也不替代机构对受检者的告知与授权。本政策说明隐私安排，不替代机构与我们之间的服务约定。"
      ]
    },
    "en": {
      "title": "1. Scope and roles",
      "paragraphs": [
        "This notice describes how 绳墨生物科技有限公司 (SchemaBio) processes personal information when providing the hosted YiJian service. It covers visitors, institutional account users, and individuals whose information is included in analysis data. Independently deployed instances are operated by their deploying institutions; this notice covers information we actually receive or process.",
        "We determine the purposes and means of processing account, security, support and business administration information for our service. For sample, sequencing, clinical and analysis information submitted by an institution, we generally act on that institution's lawful instructions as a processor. The institution determines its lawful basis, notices and required authorizations. Actual activities and agreements determine the parties' roles.",
        "Reading this notice or checking a login box does not replace separate consent or other authorization required for sensitive information, international transfers or other activities. This policy describes privacy arrangements and does not replace the institution’s service agreement with us."
      ]
    }
  },
  {
    "id": "information",
    "zh": {
      "title": "第二条 信息类别、来源和目的",
      "paragraphs": [
        "我们可从使用者、其所属机构及服务运行过程中取得：账户和机构信息；样本编号、性别、年龄、诊断和 HPO 表型；上传文件、序列、变异、基因、报告及人工解读；任务、操作人、时间、审计、计费、支持和访问记录。遗传、医疗健康及部分未成年人信息可能属于敏感个人信息或特殊类别数据；样本化名不保证匿名。",
        "这些信息用于认证和权限管理、机构协作、执行分析、展示和保存结果、生成报告、处理支持请求、计费、安全防护、审计及履行法定义务。请提交完成所需功能必要的信息，避免在文件名或自由文本中添加无关身份信息。科研和模型训练等新的用途需要另行确定合法依据及必要告知、授权。",
        "遗传与健康信息是完成所请求分析及解读的必要输入；不提供必要信息时，相关功能可能无法完成。泄露或不当使用可能影响个人隐私、家庭成员及其他权益。访问记录可能包含 IP 地址和浏览器信息。"
      ]
    },
    "en": {
      "title": "2. Information, sources and purposes",
      "paragraphs": [
        "We may receive from users, their institutions and service operations: account and organization details; sample identifiers, sex, age, diagnoses and HPO terms; uploaded files, sequences, variants, genes, reports and interpretations; and task, operator, timestamp, audit, billing, support and access records. Genetic and health information, and certain children's information, may be sensitive or special-category data. Pseudonymous sample identifiers do not guarantee anonymity.",
        "We use this information for authentication, access control, collaboration, analysis, result storage and display, reports, support, billing, security, auditing and legal obligations. Submit only what the requested function needs and avoid unnecessary identifying details in filenames or free text. New research or model-training purposes require their own lawful basis and any required notices and authorizations.",
        "Genetic and health information is necessary for the requested analysis and interpretation; missing necessary inputs may prevent those functions. Disclosure or misuse may affect privacy, family members and other rights. Access records may include IP addresses and browser details."
      ]
    }
  },
  {
    "id": "basis",
    "zh": {
      "title": "第三条 处理依据与敏感数据",
      "paragraphs": [
        "账户和服务管理处理依适用法律，可基于履行合同、法定义务或法律允许的合法利益；合法利益限于必要运营和服务安全，并须考虑个人权益。依赖同意时，可依法撤回。机构提交的健康、遗传数据还须满足相应敏感数据条件。在中国，依适用法律履行必要性、告知、单独同意等要求；在 GDPR 适用时，同时满足第 6 条依据和第 9 条条件。伦理批准并非在所有情形下替代个人信息处理依据。"
      ]
    },
    "en": {
      "title": "3. Legal bases and sensitive information",
      "paragraphs": [
        "Under applicable law, account and service administration may rely on contract performance, legal obligations or permitted legitimate interests limited to necessary operations and service security, taking individual rights into account. Where processing relies on consent, withdrawal is available as required by law. Institutional health and genetic data also requires an applicable sensitive-data condition. Chinese requirements include necessity, notice and separate consent where applicable. Where GDPR applies, both an Article 6 basis and an Article 9 condition are required. Ethics approval does not universally replace a data-protection legal basis."
      ]
    }
  },
  {
    "id": "providers",
    "zh": {
      "title": "第四条 接收方、AI 与国际传输",
      "paragraphs": [
        "必要接收方包括机构内获授权人员，以及承担托管、存储、网络、安全、支持或 AI 功能的服务提供商。披露范围限于相应目的，并按适用法律以处理协议和访问控制管理；法律要求的披露按合法程序处理。公共注释数据库的引用与向外部接口提交数据是不同活动。我们不出售机构提交的分析数据，也不将其用于跨情境行为广告共享。",
        "AI 辅助启用时，您提交或选取的诊断、表型、变异及相关上下文可能发送给该部署配置的模型服务提供商。供应商、服务区域、保存及再利用安排依实际配置和协议确定；使用前可联系管理员或我们核实。请勿在提示词中加入无关身份信息。AI 结果需专业人员核对，不作为对个人作出具有法律或类似重大影响决定的唯一依据；本政策不授权新增训练或独立研究用途。",
        "中国境内与海外服务采用各自的部署安排。海外托管服务使用海外云厂商或腾讯云海外区域，不使用中国境内服务器。具体国家或地区、供应商及受托安排由所用实例的配置和服务约定确定；海外不等于欧盟境内。跨区域支持访问、网络代理、AI 调用或机构转发仍可能涉及国际传输。GDPR 适用时，依法采用适当跨境机制，例如适用的标准合同条款及必要评估和补充措施；中国数据出境按适用规定落实告知、单独同意、评估、合同或认证等要求及例外。人类遗传资源相关要求依实际活动另行判断，不能由阅读本政策替代。"
      ]
    },
    "en": {
      "title": "4. Recipients, AI and international transfers",
      "paragraphs": [
        "Necessary recipients include authorized institutional personnel and providers of hosting, storage, networking, security, support or AI functions. Disclosures are limited to relevant purposes and managed through applicable processing agreements and access controls. Legally required disclosures follow lawful procedures. Referencing public annotation databases differs from transmitting information to an external API. We do not sell institutional analysis data or share it for cross-context behavioral advertising.",
        "When AI assistance is enabled, diagnoses, phenotypes, variants and related context you submit or select may be sent to the model provider configured for the deployment. Provider, service region, retention and reuse depend on actual configuration and agreements; contact your administrator or us before use to verify them. Avoid unnecessary identifiers in prompts. AI outputs require professional review and are not the sole basis for decisions with legal or similarly significant effects on individuals. This policy does not authorize new training or independent research purposes.",
        "Mainland China and overseas services use separate deployment arrangements. Overseas hosting uses overseas cloud providers or Tencent Cloud’s overseas regions and does not use servers in mainland China. Specific countries or regions, providers and processing arrangements depend on instance configuration and service agreements; overseas does not necessarily mean within the EU. Cross-region support, network intermediaries, AI calls and institutional onward disclosures may still involve international transfers. Where GDPR applies, appropriate transfer mechanisms apply, such as applicable Standard Contractual Clauses with necessary assessments and supplementary measures. Transfers from China follow applicable notice, separate consent, assessment, contractual or certification requirements and exemptions. Human genetic resources requirements depend on actual activities and are not replaced by reading this policy."
      ]
    }
  },
  {
    "id": "retention",
    "zh": {
      "title": "第五条 数据保留与删除策略",
      "paragraphs": [
        "上传数据按数据中心显示的适用保留期限和到期时间管理；当前默认七天策略取决于文件类型和部署配置。分析产生的 BAM 当前自任务完成起保留七天，到期后按清理策略删除。长期保存的 BED 不适用同一七天规则；分析结果、报告和审计记录也不因原始文件到期而自动全部删除。请在到期前依法保存所需资料。",
        "其他信息的保留期限依据服务需要、机构指示、合同及适用的法定保存义务确定，可联系我们了解具体类别的保留安排或提出删除请求。删除请求依权限及适用法律处理，并覆盖适用的接收方和备份安排。因账务、争议或法律义务需要保留的部分应限制其他使用并说明原因。备份按相应生命周期清除或隔离，恢复时继续执行适用删除要求。机构或用户已下载的副本由相应持有人管理。"
      ]
    },
    "en": {
      "title": "5. Retention and deletion",
      "paragraphs": [
        "Uploaded data follows the applicable retention period and expiry shown in the data center; the current default seven-day policy depends on file type and deployment configuration. Analysis-generated BAM files currently have a seven-day period starting at task completion and are deleted under the cleanup policy after expiry. Long-term BED files are not subject to the same seven-day rule. Analysis results, reports and audit records are not all automatically deleted when raw files expire. Keep necessary records lawfully before expiry.",
        "Other retention periods depend on service needs, institutional instructions, contracts and applicable statutory obligations. Contact us for category-specific arrangements or to request deletion. Deletion is handled subject to authority and applicable law and addresses relevant recipients and backups. Other uses of information retained for accounting, disputes or legal obligations are restricted and the reason explained. Backups are cleared or isolated under their lifecycle, with applicable deletion requirements continuing upon restoration. Downloaded copies are managed by their respective holders."
      ]
    }
  },
  {
    "id": "security",
    "zh": {
      "title": "第六条 安全、Cookie 与浏览器处理",
      "paragraphs": [
        "我们采用与风险相称的认证、权限、传输保护、组织隔离和审计措施。没有系统能够保证绝对安全。发生安全事件时，按适用法律和合同履行调查、补救和通知义务。请保护账户并及时报告异常访问。",
        "浏览器使用认证、CSRF 防护等必要 Cookie 及设置存储；部分查询和导出在浏览器内计算，不改变此前获取数据的服务端处理。新增非必要分析或广告技术前应更新告知及适用的选择机制。"
      ]
    },
    "en": {
      "title": "6. Security, cookies and browser processing",
      "paragraphs": [
        "We use risk-appropriate authentication, permissions, transport protection, organization separation and auditing. No system guarantees absolute security. Security incidents are investigated, mitigated and notified as required by applicable law and contracts. Protect your account and report unusual access promptly.",
        "The browser uses necessary authentication and CSRF-protection cookies and settings storage. Some queries and exports run in the browser; this does not remove the server processing involved in obtaining the data. Introducing non-essential analytics or advertising technology requires updated disclosures and applicable choices."
      ]
    }
  },
  {
    "id": "rights",
    "zh": {
      "title": "第七条 权利、请求与未成年人",
      "paragraphs": [
        "依适用法律及其例外，个人可请求访问或复制、更正、删除、限制处理、反对处理、可携带副本，以及撤回同意；撤回不影响此前合法处理。可通过本政策列明的隐私邮箱提出请求，我们适度验证身份，按法定期限回复，不因依法行使权利而歧视。机构控制的样本数据请求通常需由机构处理，我们依约协助；法律保留要求和他人权利可能限制部分请求。",
        "中国法律适用时，个人可要求解释处理规则，并依法投诉或寻求救济。GDPR 适用时，可向有管辖权的监管机构投诉；请求一般在一个月内答复，符合法定条件的延期会说明原因。加州居民在 CCPA 适用时享有知情、访问、更正、删除、适用的出售或共享退出及敏感信息限制权利，并可按规定委托代理人。其他州居民的适用权利或申诉亦可通过隐私邮箱提出。代表、数据保护联系人及具体传输保障信息可通过该邮箱咨询。依法需要的独立消费者健康数据政策和退出机制须随相关服务提供。",
        "平台面向专业机构及获授权人员。处理未成年人数据须按适用法律取得必要授权、实施保护并遵守机构伦理要求；在中国涉及不满十四周岁儿童个人信息时适用专门规则。处理美国 HIPAA 范围内的信息时须事先落实适用的 BAA 和保护措施；本政策不是 HIPAA 合规证明。"
      ]
    },
    "en": {
      "title": "7. Rights, requests and children",
      "paragraphs": [
        "Subject to applicable law and exceptions, individuals may request access or copies, correction, deletion, restriction, objection, portability and withdrawal of consent. Withdrawal does not affect earlier lawful processing. Requests may be submitted through the privacy email listed in this policy. We verify identity proportionately, respond within applicable statutory periods and do not discriminate for exercising lawful rights. Institutions generally handle requests concerning data they control, with our contractual assistance. Legal retention duties and others' rights may limit requests.",
        "Where Chinese law applies, individuals may request explanations of processing rules and pursue complaints or lawful remedies. Where GDPR applies, individuals may complain to a competent supervisory authority; requests are generally answered within one month, with reasons given for lawful extensions. Where CCPA applies, California residents have applicable rights to information, access, correction, deletion, sale or sharing opt-outs and sensitive-information limits, and may use authorized agents as permitted. Other applicable state rights and appeals may also be submitted through the privacy email. Contact that email for representative, data-protection contact and specific transfer safeguard information. Any legally required distinct consumer health data policy and opt-out mechanisms must accompany the relevant service.",
        "The platform serves professional institutions and authorized users. Processing children's data requires applicable authorizations, protections and institutional ethics requirements, including special rules for children under fourteen in China. Before processing information subject to HIPAA, applicable Business Associate Agreements and safeguards must be in place. This notice is not a HIPAA compliance certification."
      ]
    }
  },
  {
    "id": "changes",
    "zh": {
      "title": "第八条 变更与联系",
      "paragraphs": [
        "我们标注更新日期和版本，并通过适当方式通知重大变更。处理目的、方式或类别发生依法需要新授权的变更时，履行相应程序，不能仅以继续使用视作同意。本政策不排除适用地区的强制性隐私权和救济。"
      ]
    },
    "en": {
      "title": "8. Changes and contact",
      "paragraphs": [
        "We state the update date and version and communicate material changes appropriately. Changes to purposes, methods or categories requiring renewed notice or authorization follow the applicable procedure; continued use alone does not imply that authorization. Mandatory local privacy rights and remedies are not excluded."
      ]
    }
  }
];
