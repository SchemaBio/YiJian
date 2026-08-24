const pythonExample = `import io
import os
import zipfile
import httpx
import pyarrow.parquet as pq
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

app = FastAPI()
API_KEY = os.environ["REPORT_API_KEY"]

class ReportRequest(BaseModel):
    request_id: str
    task_uuid: str
    result_package_url: str
    result_package_filename: str
    result_package_size_bytes: int
    result_package_expires_at: str
    report_name: str | None = None

@app.post("/reports/generate")
def generate_report(body: ReportRequest, authorization: str = Header(...)):
    if authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="invalid API key")
    response = httpx.get(body.result_package_url, timeout=120)
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as package:
        parquet_names = [n for n in package.namelist() if n.lower().endswith(".parquet")]
        if not parquet_names or "outputs.resolved.json" not in package.namelist():
            raise HTTPException(422, "result package is incomplete")
        table = pq.read_table(package.open(parquet_names[0]))
        # 用 table / 其它 parquet 文件生成真实 PDF、DOCX 等报告。
        content = f"Report for {body.task_uuid}; rows={table.num_rows}\\n"
    return PlainTextResponse(content, headers={"Content-Disposition": 'attachment; filename="report.txt"'})`;

const goExample = `package main

import (
    "archive/zip"
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
)

type ReportRequest struct {
    TaskUUID string \`json:"task_uuid"\`
    ResultPackageURL string \`json:"result_package_url"\`
}

func generateReport(w http.ResponseWriter, r *http.Request) {
    if r.Header.Get("Authorization") != "Bearer "+os.Getenv("REPORT_API_KEY") {
        http.Error(w, "invalid API key", http.StatusUnauthorized)
        return
    }
    var body ReportRequest
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TaskUUID == "" || body.ResultPackageURL == "" {
        http.Error(w, "task_uuid and result_package_url are required", http.StatusBadRequest)
        return
    }
    response, err := http.Get(body.ResultPackageURL)
    if err != nil || response.StatusCode != http.StatusOK {
        http.Error(w, "failed to download result package", http.StatusBadGateway)
        return
    }
    defer response.Body.Close()
    zipBytes, err := io.ReadAll(response.Body)
    if err != nil { http.Error(w, "failed to read result package", 502); return }
    archive, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
    if err != nil { http.Error(w, "invalid result package", 422); return }
    parquetCount := 0
    for _, file := range archive.File {
        if len(file.Name) >= 8 && file.Name[len(file.Name)-8:] == ".parquet" { parquetCount++ }
    }
    if parquetCount == 0 { http.Error(w, "result package has no parquet", 422); return }
    // 用 archive.File 中的 parquet 数据生成真实 PDF/DOCX 报告。
    w.Header().Set("Content-Type", "text/plain; charset=utf-8")
    w.Header().Set("Content-Disposition", \`attachment; filename="report.txt"\`)
    fmt.Fprintf(w, "Report for task %s; parquet files=%d\\n", body.TaskUUID, parquetCount)
}

func main() {
    http.HandleFunc("/reports/generate", generateReport)
    http.ListenAndServe(":8000", nil)
}`;

const javascriptExample = `import express from "express";
import axios from "axios";
import AdmZip from "adm-zip";

const app = express();
app.use(express.json());

app.post("/reports/generate", async (req, res) => {
  if (req.get("authorization") !== \`Bearer \${process.env.REPORT_API_KEY}\`) {
    return res.status(401).json({ detail: "invalid API key" });
  }
  const { task_uuid, result_package_url } = req.body;
  if (!task_uuid || !result_package_url) {
    return res.status(400).json({ detail: "task_uuid and result_package_url are required" });
  }
  const packageResponse = await axios.get(result_package_url, { responseType: "arraybuffer" });
  const archive = new AdmZip(packageResponse.data);
  const parquetFiles = archive.getEntries().filter((entry) => entry.entryName.endsWith(".parquet"));
  if (!parquetFiles.length || !archive.getEntry("outputs.resolved.json")) {
    return res.status(422).json({ detail: "result package is incomplete" });
  }
  // 用 parquetFiles 的 Buffer 读取 Parquet，并生成真实 PDF/DOCX 报告。
  res.attachment("report.txt");
  res.type("text/plain").send(\`Report for task \${task_uuid}; parquet files=\${parquetFiles.length}\\n\`);
});

app.listen(8000);`;

const examples = [
  { language: 'Python · FastAPI', code: pythonExample },
  { language: 'Go · net/http', code: goExample },
  { language: 'JavaScript · Express', code: javascriptExample },
];

export function ReportEndpointExamples() {
  return (
    <details className="group rounded-md border border-border-default bg-canvas-default">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-fg-default marker:text-fg-muted">
        查看 Python、Go、JavaScript 接入示例
      </summary>
      <div className="space-y-4 border-t border-border-default px-3 py-3">
        <p className="text-xs text-fg-muted">
          示例会下载短期预签名 ZIP，读取 outputs.resolved.json 和 Parquet；把注释位置替换为你的 PDF/DOCX 生成逻辑即可。
        </p>
        {examples.map((example) => (
          <section key={example.language} className="space-y-1.5">
            <h4 className="text-xs font-semibold text-fg-default">{example.language}</h4>
            <pre className="max-h-72 overflow-auto rounded-md bg-canvas-subtle p-3 text-xs leading-5 text-fg-default">
              <code>{example.code}</code>
            </pre>
          </section>
        ))}
      </div>
    </details>
  );
}
