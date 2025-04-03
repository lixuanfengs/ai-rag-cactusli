package cn.cactusli.lxf.rag.trigger.http;

import cn.cactusli.lxf.rag.api.IRAGService;
import cn.cactusli.lxf.rag.api.response.Response;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RList;
import org.redisson.api.RedissonClient;
import org.springframework.ai.document.Document;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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

    @GetMapping(value = "file/upload", headers = "content-type=multipart/form-data")
    @Override
    public Response<String> uploadFile(@RequestParam String ragTag, @RequestParam("file") List<MultipartFile> files) {
        log.info("上传知识库开始 {}", ragTag);
        for (MultipartFile file : files) {
            TikaDocumentReader documentReader = new TikaDocumentReader(file.getResource());
            List<Document> documents = documentReader.get();
            List<Document> documentSplitterList = tokenTextSplitter.apply(documents);

            documents.forEach(doc -> doc.getMetadata().put("cactusli", ragTag));
            documentSplitterList.forEach(doc -> doc.getMetadata().put("cactusli", ragTag));

            pgVectorStore.accept(documentSplitterList);

            RList<String> elements = redissonClient.getList("ragTag");
            if (!elements.contains(ragTag)){
                elements.add(ragTag);
            }
        }
        log.info("上传知识库完成 {}", ragTag);
        return Response.<String>builder().code("1000").info("调用成功").build();
    }

}
