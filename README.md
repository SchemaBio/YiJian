# YiJian

**English** | [中文](./README.zh-CN.md)

Open-source web frontend for germline bioinformatics analysis and variant annotation. It covers the path from FASTQ to analysis results: quality control, variant annotation, and result browsing. It connects to a self-hosted [Octopus](https://github.com/SchemaBio/Octopus) API.

Licensed under the [Apache License 2.0](./LICENSE).

## Scope

This repository is the open-source, self-hosted edition. Deployers choose the use case, workflows, data retention, and how results are used. They are responsible for authorization of input data, security, result validation, personnel qualifications, and applicable legal and regulatory requirements.

The software and its output do not automatically constitute a validated medical product or a diagnostic conclusion. If used in a regulated setting, the deployer completes the required validation and procedures. The Apache License does not replace those requirements, and this notice does not add use restrictions beyond the license.

## What it includes

- Dashboard, sample list, and pedigree management
- Data center for sequencing files
- Task center: create tasks, inspect runs, browse variants, QC, IGV, and reports
- Historical findings
- Pipeline center: pipelines, gene lists, BED files, CNV baselines, and report service
- Platform administration and permission settings (platform administrators)
- AI assistance for organizing evidence and screening research candidates

CNV baseline-correction tasks (`baseline_fix`) produce baseline resources, not interpretation reports. Their task-detail route returns 404.

## Requirements

- Node.js 22
- pnpm 9.15.9 (`packageManager` in `package.json`)
- A reachable Octopus API (default `http://localhost:8080/api`)

## Local development

```sh
cp .env.example .env.local
pnpm install
pnpm dev
```

The default development configuration connects directly to `http://localhost:8080/api`.

## Configuration

YiJian needs an API URL and a backend type. For this open-source edition, the backend is `octopus`.

```env
# Docker runtime
YIJIAN_API_URL=/api
YIJIAN_BACKEND=octopus

# Next.js local development
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_BACKEND=octopus
```

Older deployments may still set `YIJIAN_BACKEND_FLAVOR`. New configuration should use `YIJIAN_BACKEND`.

Task-detail routes verify the task on the server. Docker defaults to `http://octopus:8080/api`. For a custom network or port, set the server-only `YIJIAN_SERVER_API_URL`. Do not put a browser-side localhost address there.

Other runtime settings, with defaults from `.env.example` and `docker-entrypoint.sh`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `YIJIAN_DEFAULT_LOCALE` | `zh-CN` | Deployment default language |
| `YIJIAN_UPLOAD_ORIGINS` | empty | Extra allowed upload origins |
| `YIJIAN_PASSWORD_RESET_ENABLED` | `false` | Password reset |
| `NEXT_PUBLIC_PASSWORD_HASH_ENABLED` | `false` | Client-side password hashing. Baked in at image build time |
| `NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED` | `true` | Privacy consent. Baked in at image build time |
| `NEXT_PUBLIC_ASSESSMENT_OPTIMIZED` | `false` | Assessment cache/pipeline/index opt-in. Build argument; changing it requires rebuilding the image. Keep disabled pending acceptance |

`NEXT_PUBLIC_DEV_MOCK_AUTH=true` is rejected in production images.

## Docker

```sh
docker build -t yijian .
docker run -p 3000:3000 \
  -e YIJIAN_API_URL=/api \
  -e YIJIAN_BACKEND=octopus \
  yijian
```

The entrypoint writes `public/runtime-config.js` from the environment, so API URL, backend, upload origins, password reset, and default locale can change without rebuilding the image. The image listens on port 3000 and runs as a non-root user.

## Interface language

Supported locales: Simplified Chinese (`zh-CN`), generic Traditional Chinese (`zh-Hant`), English (`en`), and Latin American Spanish (`es-419`).

Choose a language under Settings → Personal settings → Interface language, then save. The preference is stored for one year in the current site’s `yijian-locale` cookie. It survives sign-out and is not synced across devices.

The Docker default is `YIJIAN_DEFAULT_LOCALE` (`zh-CN` if unset). The same image supports all four defaults. After changing it, recreate the container; rebuilding the image is not required. An existing browser preference overrides the deployment default. The language is not chosen from the browser locale.

Local development uses `NEXT_PUBLIC_DEFAULT_LOCALE`.

Sample records, report body text, AI output, and original files stay in their source language.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm build
node scripts/check-i18n.cjs
```

Reverse proxy, TLS, and public access control are the deployer’s responsibility.

### Self-hosted business permissions

The platform administrator can assign nine independent business permissions in Platform Management. Administrators always have every permission. All ordinary accounts, including existing accounts and self-registered users, start read-only. Users can browse, query and download local business data shared across the instance; granted permissions allow managing resources created by other local users. Personal preferences and credentials remain private.

This applies only to the Octopus open-source edition. SaaS via Squid keeps its existing single-user and tenant isolation behavior. Deploy the Octopus database/backend update before YiJian. Permission changes take effect on subsequent API requests without signing in again; the interface refreshes permissions on window focus and permission errors. Running tasks continue after revocation.

## VCF2Anno

支持 VCF 起始的 SNP/InDel 注释，hg19/hg38 共用工作流；SaaS 沿用 WES 计算时间计费，自部署不扣积分。输入、部署、配置及验证见 [VCF2Anno 接入说明](docs/VCF2ANNO.md)。
