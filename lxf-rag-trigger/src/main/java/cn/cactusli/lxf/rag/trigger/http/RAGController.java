package cn.cactusli.lxf.rag.trigger.http;

import cn.cactusli.lxf.rag.api.IRAGService;
import cn.cactusli.lxf.rag.api.response.Response;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.redisson.api.RList;
import org.redisson.api.RedissonClient;
import org.springframework.ai.document.Document;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.core.io.PathResource;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;

/**
 * Package: cn.cactusli.lxf.rag.trigger.http
 * Description:
 *
 * @Author 仙人球⁶ᴳ |
 * @Date 2025/4/3 10:22
 * @Github https://github.com/lixuanfengs
 */
@Slf4j
@RestController
@CrossOrigin("*")
@RequestMapping("/api/v1/rag/")
public class RAGController implements IRAGService {

    @Resource
    private OllamaChatModel ollamaChatModel;
    @Resource
    private TokenTextSplitter tokenTextSplitter;
    @Resource
    private SimpleVectorStore simpleVectorStore;
    @Resource
    private PgVectorStore pgVectorStore;
    @Resource
    private RedissonClient redissonClient;

    @GetMapping("/query_rag_tag_list")
    @Override
    public Response<List<String>> queryRagTagList() {
        RList<String> ragTagList = redissonClient.getList("ragTag");
        return Response.<List<String>>builder()
                .code("1000")
                .info("调用成功")
                .data(ragTagList)
                .build();
    }

    @PostMapping(value = "file/upload", headers = "content-type=multipart/form-data")
    @Override
    public Response<String> uploadFile(@RequestParam("ragTag") String ragTag, @RequestParam("file") List<MultipartFile> files) {
        log.info("上传知识库开始 {}", ragTag);
        for (MultipartFile file : files) {
            TikaDocumentReader documentReader = new TikaDocumentReader(file.getResource());
            List<Document> documents = documentReader.get();
            List<Document> documentSplitterList = tokenTextSplitter.apply(documents);
            // 添加知识库标签
            documents.forEach(doc -> doc.getMetadata().put("cactusli", ragTag));
            documentSplitterList.forEach(doc -> doc.getMetadata().put("cactusli", ragTag));
            pgVectorStore.accept(documentSplitterList);

            // 添加知识库记录
            RList<String> elements = redissonClient.getList("ragTag");
            if (!elements.contains(ragTag)){
                elements.add(ragTag);
            }
        }
        log.info("上传知识库完成 {}", ragTag);
        return Response.<String>builder().code("1000").info("调用成功").build();
    }

    @PostMapping(value = "analyze_git_repository")
    @Override
    public Response<String> analyzeGitRepository(@RequestParam("repoUrl") String repoUrl,
                                                 @RequestParam("userName") String userName,
                                                 @RequestParam("token") String token) throws Exception {
        // 定义本地克隆路径
        String localPath = "./git-cloned-repo";
        // 从仓库 URL 提取项目名称 (例如: "repo")
        String repoProjectName = extractProjectName(repoUrl);
        log.info("克隆路径：{}", new File(localPath).getAbsolutePath());

        // 清理旧的克隆目录：确保每次都是全新克隆，防止旧文件干扰
        FileUtils.deleteDirectory(new File(localPath));

        Git git = Git.cloneRepository()
                .setURI(repoUrl)
                .setDirectory(new File(localPath)) // 设置本地克隆目录
                // 设置凭证，用于访问需要认证的仓库 (如私有库)
                .setCredentialsProvider(new UsernamePasswordCredentialsProvider(userName, token))
                .call();// 执行克隆操作

        Files.walkFileTree(Paths.get(localPath), new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                // 忽略 .git 目录下的文件
                if (file.toString().contains(File.separator + ".git" + File.separator)) {
                    return FileVisitResult.CONTINUE;
                }
                log.info("{} 遍历解析路径，上传知识库:{}", repoProjectName, file.getFileName());
                try {
                    // 使用 TikaDocumentReader 读取和解析文件内容
                    TikaDocumentReader reader = new TikaDocumentReader(new PathResource(file));
                    // 获取解析后的文档列表 (Tika 可能将一个文件解析为多个 Document)
                    List<Document> documents = reader.get();
                    // 使用 TokenTextSplitter 将文档分割成更小的块
                    // 这有助于向量化和检索，因为模型通常有输入长度限制
                    List<Document> documentSplitterList = tokenTextSplitter.apply(documents);

                    // 为原始文档添加元数据 (这部分可能非必需，除非原始文档也用于其他目的)
                    documents.forEach(doc -> doc.getMetadata().put("cactusli", repoProjectName));

                    // 为分割后的文档块添加元数据，键为 "cactusli"，值为仓库项目名
                    // 这个元数据可以用于后续检索时按项目进行过滤
                    documentSplitterList.forEach(doc -> doc.getMetadata().put("cactusli", repoProjectName));

                    // 将分割后的文档块列表提交给 VectorStore 进行处理和存储
                    // VectorStore 通常会进行文本嵌入（向量化）并存入数据库
                    pgVectorStore.accept(documentSplitterList);
                } catch (Exception e) {
                    log.error("遍历解析路径，上传知识库失败:{}", file.getFileName());
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFileFailed(Path file, IOException exc) throws IOException {
                log.info("Failed to access file: {} - {}", file.toString(), exc.getMessage());
                return FileVisitResult.CONTINUE;
            }
        });

        // 确保 Git 对象被关闭，释放资源 (例如文件句柄)
        git.close();


        // 处理完成后，再次删除本地克隆的仓库目录，进行清理
        FileUtils.deleteDirectory(new File(localPath));

        RList<String> elements = redissonClient.getList("ragTag");
        if (!elements.contains(repoProjectName)) {
            elements.add(repoProjectName);
        }


        log.info("遍历解析路径，上传完成:{}", repoUrl);

        return Response.<String>builder().code("1000").info("调用成功").build();
    }

    /**
     * 从 Git 仓库 URL 中提取项目名称。
     * 例如，从 "https://github.com/user/my-repo.git" 提取 "my-repo"。
     *
     * @param repoUrl Git 仓库的 URL
     * @return 提取出的项目名称 (移除了 ".git" 后缀)
     */
    private String extractProjectName(String repoUrl) {
        String[] parts = repoUrl.split("/");
        String projectNameWithGit = parts[parts.length - 1];
        return projectNameWithGit.replace(".git", "");
    }

}
