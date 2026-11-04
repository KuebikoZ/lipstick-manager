# AI 图片识别评测

真实评测集必须包含至少 5 个经本人授权使用的口红包装图片样本，每个样本可含 1–3 张图片。图片和带有个人信息的清单不得提交 Git；仅把生成的脱敏汇总报告纳入项目记录。5 个样本只作为开发基线，不外推整体识别准确率。

私有 manifest 格式：

```json
{"version":"1","cases":[{"id":"sample-01","image_paths":["/absolute/private/sample-01.jpg"],"expected":{"brand":"品牌","series":null,"shade_code":"01","color_family":"red"}}]}
```

补足至少 5 条并确认 DeepSeek 单次及总费用后运行：

```bash
pnpm ai:evaluate /absolute/private/ai-samples.json /absolute/report.json 5
```

最后一个参数表示需要执行第二轮的一组样本数。命令调用真实 DeepSeek Vision、Search 和 Fetch，并把脱敏 JSON 评测结果写入指定报告。结果包括逐字段正确性、总体字段准确率、重复一致性覆盖率和失败样例；不自动上传或提交原图。
