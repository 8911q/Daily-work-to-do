### 一键部署步骤

1. 安装 Wrangler CLI: 如果您尚未安装，请通过 npm 安装 Wrangler CLI：

```npm install -g wrangler```

2. 创建项目文件夹:

```mkdir weekly-planner-worker```
```cd weekly-planner-worker```

3. 创建文件: 在此文件夹中，创建以下文件和子文件夹，并将相应代码复制到文件中：

- wrangler.toml (复制上面的toml代码)

- src/index.js (复制上面的js代码)

4. 初始化项目: 运行 wrangler login 登录到您的 Cloudflare 账户。然后运行：

```wrangler init --from-existing .```
	这个命令将生成一个基础的 Worker 项目结构，但我们已经有src/index.js，所以不用担心。

5. 创建 KV Namespace: 运行以下命令，创建一个名为 TASK_KV 的KV Namespace。

``` wrangler kv:namespace create TASK_KV```
**注意**: 运行此命令后，您将看到一个 Namespace ID。请复制这个 ID。

6. 更新 wrangler.toml: 将上一步复制的 Namespace ID 替换 wrangler.toml 中 ```TASK_KV = "YOUR_KV_NAMESPACE_ID"``` 的 ```YOUR_KV_NAMESPACE_ID```。

7. 部署项目: 最后，运行以下命令进行部署：

```wrangler deploy```
	Wrangler 将自动将您的代码和文件部署到 Cloudflare，并绑定您的 KV 存储。

部署成功后，您就可以通过Worker的URL访问您的每日工作计划应用了。

8. 后台管理
	增加环境变量```ADMIN_PASSWORD```为后台管理密码
 	后台按理页面```/admin.html```
