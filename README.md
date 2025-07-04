# AI-RAG-CactusLi 🌵

<div align="center">

[![Java](https://img.shields.io/badge/Java-17-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.3-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Spring AI](https://img.shields.io/badge/Spring%20AI-1.0.0--SNAPSHOT-blue.svg)](https://spring.io/projects/spring-ai)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com/)

**基于 Spring AI + Ollama + DeepSeek 构建的企业级 RAG 知识库检索系统**

[📖 教程文档](https://cactusli.net/) | [🚀 快速开始](#快速开始) | [📋 API 文档](#api-接口) | [🐳 Docker 部署](#docker-部署)

</div>

## 📋 项目简介

AI-RAG-CactusLi 是一套功能完整的企业级 RAG（检索增强生成）知识库系统，专为提升工程师开发效率而设计。系统不仅支持传统文档的知识解析，还创新性地集成了 Git 代码库的自动拉取与解析功能，为开发团队提供智能化的知识检索和问答服务。

### ✨ 核心特性

- 🤖 **多模型支持**：集成 Ollama (DeepSeek) 和 OpenAI 模型
- 📚 **智能文档解析**：支持多种格式文档的自动解析和向量化
- 🔍 **代码库分析**：自动克隆和解析 Git 仓库，构建代码知识库
- 💬 **RAG 问答**：基于知识库的智能问答，支持实时流式响应
- 🏷️ **多知识库管理**：通过标签系统管理不同领域的知识库
- 🚀 **高性能架构**：基于 Spring AI 框架，支持高并发访问
- 🐳 **容器化部署**：提供完整的 Docker 部署方案
- 📊 **向量检索**：使用 PgVector 实现高效的向量相似度搜索

### 🎯 应用场景

- **需求分析**：基于历史项目文档进行需求理解和分析
- **研发设计**：利用代码库知识辅助系统设计和架构决策
- **辅助编码**：通过代码知识库提供编程建议和最佳实践
- **代码评审**：基于项目规范和历史代码进行智能代码审查
- **风险评估**：结合项目文档和代码分析潜在技术风险
- **上线检测**：基于知识库进行部署前的智能检查

## 🏗️ 系统架构

```mermaid
graph TB
    subgraph "客户端层"
        A[Web前端] --> B[HTTP API]
        C[移动端] --> B
    end

    subgraph "应用层"
        B --> D[lxf-rag-trigger]
        D --> E[OllamaController]
        D --> F[OpenAiController]
        D --> G[RAGController]
    end

    subgraph "业务层"
        E --> H[lxf-rag-app]
        F --> H
        G --> H
        H --> I[AI Service]
        H --> J[RAG Service]
    end

    subgraph "数据层"
        I --> K[Ollama API]
        I --> L[OpenAI API]
        J --> M[PgVector]
        J --> N[Redis]
        J --> O[Git Repository]
    end

    subgraph "基础设施"
        K --> P[DeepSeek Model]
        M --> Q[PostgreSQL]
        N --> R[Redis Cache]
    end
```

## 🛠️ 技术栈

| 技术栈 | 版本 | 说明 |
|--------|------|------|
| **后端框架** | | |
| Java | 17 | 编程语言 |
| Spring Boot | 3.2.3 | 应用框架 |
| Spring AI | 1.0.0-SNAPSHOT | AI 集成框架 |
| **AI 模型** | | |
| Ollama | 0.5.13 | 本地大模型运行环境 |
| DeepSeek | R1:1.5b | 主要对话模型 |
| OpenAI | GPT-4o-mini | 备选对话模型 |
| **数据存储** | | |
| PostgreSQL | 16 | 关系数据库 |
| PgVector | 0.7.0 | 向量数据库扩展 |
| Redis | 6.2 | 缓存数据库 |
| **工具库** | | |
| Apache Tika | - | 文档解析 |
| JGit | 5.13.0 | Git 操作 |
| Redisson | 3.44.0 | Redis 客户端 |
| Fastjson | 2.0.28 | JSON 处理 |

## 📋 环境要求

### 基础环境
- **Java**: 17 或更高版本
- **Maven**: 3.6 或更高版本
- **Docker**: 20.10 或更高版本（可选）
- **Docker Compose**: 2.0 或更高版本（可选）

### 依赖服务
- **PostgreSQL**: 16+ (需安装 pgvector 扩展)
- **Redis**: 6.2+
- **Ollama**: 0.5.13+ (需预装 DeepSeek 和 nomic-embed-text 模型)

## 🚀 快速开始

### 方式一：Docker Compose 部署（推荐）

1. **克隆项目**
```bash
git clone https://github.com/lixuanfengs/ai-rag-cactusli.git
cd ai-rag-cactusli
```

2. **启动基础服务**
```bash
cd docs/dev-ops
docker-compose -f docker-compose-environment.yml up -d
```

3. **安装 Ollama 模型**
```bash
# 安装对话模型
docker exec -it ollama ollama pull deepseek-r1:1.5b

# 安装嵌入模型
docker exec -it ollama ollama pull nomic-embed-text
```

4. **构建并运行应用**
```bash
# 返回项目根目录
cd ../..

# 编译项目
mvn clean package -DskipTests

# 构建 Docker 镜像
cd lxf-rag-app
docker build -t ai-rag-cactusli:latest .

# 运行应用
docker run -d \
  --name ai-rag-app \
  --network dev-ops_my-network \
  -p 7080:7080 \
  ai-rag-cactusli:latest
```

### 方式二：本地开发部署

1. **启动依赖服务**
```bash
# 启动 PostgreSQL、Redis、Ollama
cd docs/dev-ops
docker-compose -f docker-compose-environment.yml up -d
```

2. **配置数据库**
```bash
# 连接到 PostgreSQL 并创建数据库
docker exec -it vector_db psql -U postgres -c "CREATE DATABASE \"ai-rag-cactusli\";"
```

3. **修改配置文件**
```yaml
# lxf-rag-app/src/main/resources/application-dev.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/ai-rag-cactusli
    username: postgres
    password: postgres
  ai:
    ollama:
      base-url: http://localhost:11434
    openai:
      api-key: your-openai-api-key  # 如需使用 OpenAI
```

4. **启动应用**
```bash
# 编译并运行
mvn clean package -DskipTests
cd lxf-rag-app
mvn spring-boot:run
```

### 验证部署

访问以下地址验证服务是否正常：

- **应用健康检查**: http://localhost:7080/actuator/health
- **Redis 管理界面**: http://localhost:8081 (admin/admin)
- **Ollama API**: http://localhost:11434/api/tags

## ⚙️ 配置说明

### 核心配置项

```yaml
spring:
  ai:
    # Ollama 配置
    ollama:
      base-url: http://localhost:11434
      embedding:
        model: nomic-embed-text

    # OpenAI 配置（可选）
    openai:
      base-url: https://api.openai.com
      api-key: your-api-key
      embedding:
        options:
          model: text-embedding-3-small

    # 向量数据库配置
    vectorstore:
      pgvector:
        index-type: HNSW
        distance-type: COSINE_DISTANCE
        dimensions: 1536

# Redis 配置
redis:
  sdk:
    config:
      host: localhost
      port: 16379
      pool-size: 10
```

### 环境配置

项目支持多环境配置：
- `application-dev.yml`: 开发环境
- `application-test.yml`: 测试环境
- `application-prod.yml`: 生产环境

通过 `spring.profiles.active` 参数切换环境。

## 📋 API 接口

### RAG 知识库管理

#### 1. 查询知识库标签列表
```http
GET /api/v1/rag/query_rag_tag_list
```

**响应示例：**
```json
{
  "code": "1000",
  "info": "调用成功",
  "data": ["项目文档", "代码库", "技术规范"]
}
```

#### 2. 上传文档到知识库
```http
POST /api/v1/rag/file/upload
Content-Type: multipart/form-data

ragTag: 知识库标签
file: 文档文件（支持多文件）
```

**响应示例：**
```json
{
  "code": "1000",
  "info": "调用成功",
  "data": "文档上传成功"
}
```

#### 3. 分析 Git 代码库
```http
POST /api/v1/rag/analyze_git_repository

{
  "repoUrl": "https://github.com/username/repo.git",
  "userName": "your-username",
  "token": "your-access-token"
}
```

**响应示例：**
```json
{
  "code": "1000",
  "info": "调用成功",
  "data": "代码库分析完成"
}
```

### AI 对话接口

#### 1. Ollama 普通对话
```http
GET /api/v1/ollama/generate?model=deepseek-r1:1.5b&message=你好
```

#### 2. Ollama 流式对话
```http
GET /api/v1/ollama/generate_stream?model=deepseek-r1:1.5b&message=你好&history=[]
```

#### 3. Ollama RAG 问答
```http
GET /api/v1/ollama/generate_stream_rag?model=deepseek-r1:1.5b&ragTag=项目文档&message=项目架构是什么？
```

#### 4. OpenAI 接口
```http
# 普通对话
GET /api/v1/openai/generate?model=gpt-4o-mini&message=你好

# 流式对话
GET /api/v1/openai/generate_stream?model=gpt-4o-mini&message=你好&history=[]

# RAG 问答
GET /api/v1/openai/generate_stream_rag?model=gpt-4o-mini&ragTag=项目文档&message=项目架构是什么？
```

## 🐳 Docker 部署

### 完整部署脚本

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  # 应用服务
  ai-rag-app:
    image: cactuslixf/ai-rag-knowledge-app:1.2
    container_name: ai-rag-app
    restart: unless-stopped
    ports:
      - "7080:7080"
    environment:
      - SPRING_PROFILES_ACTIVE=prod
      - JAVA_OPTS=-Xms2G -Xmx4G
    depends_on:
      - vector_db
      - redis
      - ollama
    networks:
      - ai-rag-network

  # Ollama 服务
  ollama:
    image: ollama/ollama:0.5.13
    container_name: ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - ai-rag-network

  # PostgreSQL + PgVector
  vector_db:
    image: pgvector/pgvector:0.7.0-pg16
    container_name: vector_db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=ai-rag-cactusli
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docs/dev-ops/pgvector/sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - ai-rag-network

  # Redis
  redis:
    image: redis:6.2
    container_name: redis
    restart: unless-stopped
    ports:
      - "16379:6379"
    volumes:
      - redis_data:/data
      - ./docs/dev-ops/redis/redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    networks:
      - ai-rag-network

volumes:
  postgres_data:
  redis_data:
  ollama_data:

networks:
  ai-rag-network:
    driver: bridge
```

### 部署步骤

```bash
# 1. 启动所有服务
docker-compose up -d

# 2. 安装 Ollama 模型
docker exec -it ollama ollama pull deepseek-r1:1.5b
docker exec -it ollama ollama pull nomic-embed-text

# 3. 验证服务状态
docker-compose ps
```

## 💡 使用示例

### 1. 构建文档知识库

```bash
# 上传技术文档
curl -X POST "http://localhost:7080/api/v1/rag/file/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "ragTag=技术文档" \
  -F "file=@./docs/architecture.pdf" \
  -F "file=@./docs/api-spec.docx"
```

### 2. 分析代码库

```bash
# 分析 GitHub 项目
curl -X POST "http://localhost:7080/api/v1/rag/analyze_git_repository" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/spring-projects/spring-boot.git",
    "userName": "your-username",
    "token": "ghp_xxxxxxxxxxxx"
  }'
```

### 3. RAG 智能问答

```bash
# 基于知识库问答
curl "http://localhost:7080/api/v1/ollama/generate_stream_rag?model=deepseek-r1:1.5b&ragTag=技术文档&message=系统的核心架构是什么？"
```

### 4. 代码相关问答

```bash
# 询问代码实现
curl "http://localhost:7080/api/v1/ollama/generate_stream_rag?model=deepseek-r1:1.5b&ragTag=spring-boot&message=Spring Boot 的自动配置原理是什么？"
```

## 🔧 开发指南

### 项目结构

```
ai-rag-cactusli/
├── lxf-rag-api/          # API 接口定义
│   └── src/main/java/cn/cactusli/lxf/rag/api/
├── lxf-rag-app/          # 核心应用模块
│   ├── src/main/java/cn/cactusli/lxf/rag/
│   │   ├── config/       # 配置类
│   │   └── Application.java
│   └── src/main/resources/
│       ├── application.yml
│       └── application-*.yml
├── lxf-rag-trigger/      # Web 控制器
│   └── src/main/java/cn/cactusli/lxf/rag/trigger/
│       └── http/         # HTTP 接口
├── docs/                 # 文档和部署脚本
│   └── dev-ops/         # 运维相关
└── data/                # 数据目录
```

### 本地开发

1. **环境准备**
```bash
# 启动依赖服务
cd docs/dev-ops
docker-compose -f docker-compose-environment.yml up -d

# 安装模型
docker exec -it ollama ollama pull deepseek-r1:1.5b
docker exec -it ollama ollama pull nomic-embed-text
```

2. **IDE 配置**
- 导入 Maven 项目
- 设置 JDK 17
- 配置 `application-dev.yml`

3. **运行测试**
```bash
mvn test
```

4. **启动应用**
```bash
cd lxf-rag-app
mvn spring-boot:run
```

## ❓ 常见问题

### Q1: Ollama 模型下载失败怎么办？

**A:** 检查网络连接和 Ollama 服务状态：

```bash
# 检查 Ollama 服务
docker logs ollama

# 手动下载模型
docker exec -it ollama ollama pull deepseek-r1:1.5b

# 验证模型安装
docker exec -it ollama ollama list
```

### Q2: PostgreSQL 连接失败？

**A:** 确认数据库配置和网络连接：

```bash
# 检查数据库状态
docker logs vector_db

# 测试连接
docker exec -it vector_db psql -U postgres -d ai-rag-cactusli -c "SELECT version();"

# 检查数据库是否存在
docker exec -it vector_db psql -U postgres -c "\l"
```

### Q3: 向量检索结果不准确？

**A:** 优化检索参数和文档分割：

```yaml
spring:
  ai:
    vectorstore:
      pgvector:
        # 调整相似度阈值
        similarity-threshold: 0.7
        # 增加检索数量
        top-k: 10
```

### Q4: 内存不足错误？

**A:** 调整 JVM 参数：

```bash
# Docker 部署
docker run -e JAVA_OPTS="-Xms2G -Xmx4G" ai-rag-cactusli

# 本地运行
export MAVEN_OPTS="-Xms2G -Xmx4G"
mvn spring-boot:run
```

### Q5: Git 仓库克隆失败？

**A:** 检查认证信息和网络：

```bash
# 验证 Git 凭据
git clone https://username:token@github.com/user/repo.git

# 检查网络连接
curl -I https://github.com

# 使用 SSH 方式（需配置密钥）
git clone git@github.com:user/repo.git
```

## 🔍 性能优化

### 1. 数据库优化

```sql
-- 创建向量索引
CREATE INDEX CONCURRENTLY embedding_index
ON vector_store USING hnsw (embedding vector_cosine_ops);

-- 优化查询性能
ANALYZE vector_store;
```

### 2. 应用优化

```yaml
spring:
  ai:
    vectorstore:
      pgvector:
        # 批处理优化
        batching-strategy: TOKEN_COUNT
        max-document-batch-size: 5000
        # 连接池优化
        hikari:
          maximum-pool-size: 20
          minimum-idle: 5
```

### 3. Redis 缓存

```yaml
redis:
  sdk:
    config:
      # 连接池优化
      pool-size: 20
      min-idle-size: 10
      # 超时设置
      connect-timeout: 3000
      command-timeout: 5000
```

## 🛡️ 安全配置

### 1. API 安全

```yaml
spring:
  security:
    # 启用基础认证
    user:
      name: admin
      password: your-secure-password
      roles: ADMIN
```

### 2. 数据库安全

```yaml
spring:
  datasource:
    # 使用加密密码
    password: ENC(encrypted-password)
    # SSL 连接
    url: jdbc:postgresql://localhost:5432/ai-rag-cactusli?sslmode=require
```

### 3. 网络安全

```yaml
# 限制访问来源
server:
  address: 127.0.0.1  # 仅本地访问

# 或使用反向代理
nginx:
  upstream:
    - server: 127.0.0.1:7080
  ssl:
    certificate: /path/to/cert.pem
    private_key: /path/to/key.pem
```

## 📊 监控和日志

### 1. 应用监控

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: always
```

### 2. 日志配置

```xml
<!-- logback-spring.xml -->
<configuration>
    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/ai-rag-app.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/ai-rag-app.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>30</maxHistory>
        </rollingPolicy>
    </appender>

    <logger name="cn.cactusli.lxf.rag" level="INFO"/>
    <root level="INFO">
        <appender-ref ref="FILE"/>
    </root>
</configuration>
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！请遵循以下步骤：

### 1. 开发流程

```bash
# Fork 项目
git clone https://github.com/your-username/ai-rag-cactusli.git

# 创建功能分支
git checkout -b feature/your-feature-name

# 提交更改
git commit -m "feat: add your feature description"

# 推送分支
git push origin feature/your-feature-name

# 创建 Pull Request
```

### 2. 代码规范

- 遵循 Java 编码规范
- 添加必要的单元测试
- 更新相关文档
- 确保所有测试通过

### 3. 提交信息规范

```
feat: 新功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建过程或辅助工具的变动
```

## 📄 许可证

本项目采用 [Apache License 2.0](LICENSE) 许可证。

## 🙏 致谢

感谢以下开源项目的支持：

- [Spring AI](https://spring.io/projects/spring-ai) - AI 集成框架
- [Ollama](https://ollama.ai/) - 本地大模型运行环境
- [PgVector](https://github.com/pgvector/pgvector) - PostgreSQL 向量扩展
- [Apache Tika](https://tika.apache.org/) - 文档解析工具

## 📞 联系方式

- **作者**: 仙人球⁶ᴳ
- **GitHub**: [@lixuanfengs](https://github.com/lixuanfengs)
- **教程网站**: [https://cactusli.net/](https://cactusli.net/)
- **问题反馈**: [GitHub Issues](https://github.com/lixuanfengs/ai-rag-cactusli/issues)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！**

Made with ❤️ by [CactusLi](https://github.com/lixuanfengs)

</div>