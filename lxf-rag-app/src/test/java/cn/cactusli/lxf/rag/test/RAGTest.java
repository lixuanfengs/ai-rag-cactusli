package cn.cactusli.lxf.rag.test;


import com.alibaba.fastjson.JSON;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;

import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.SystemPromptTemplate;
import org.springframework.ai.document.Document;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;


/**
 * Package: cn.cactusli.lxf.rag.test
 * Description:
 *
 * @Author 仙人球⁶ᴳ |
 * @Date 2025/3/28 16:56
 * @Github https://github.com/lixuanfengs
 */
@Slf4j
@RunWith(SpringRunner.class)
@SpringBootTest
public class RAGTest {

    @Resource
    private OllamaChatModel ollamaChatModel;
    @Resource
    private OpenAiChatModel openAiChatModel;
    @Resource
    private TokenTextSplitter tokenTextSplitter;
    @Resource
    private SimpleVectorStore simpleVectorStore;
    @Resource
    private PgVectorStore pgVectorStore;


    @Test
    public void upload() {
        log.info("开始上传文档处理...");
        log.info("正在读取文件: ./data/file.text");
        TikaDocumentReader reader = new TikaDocumentReader("./data/file.text");

        List<Document> documents = reader.get();
        log.info("文档读取完成，原始文档数量: {}", documents.size());

        log.info("开始文档切分...");
        List<Document> documentSplitterList = tokenTextSplitter.apply(documents);
        log.info("文档切分完成，切分后文档数量: {}", documentSplitterList.size());

        log.info("为文档添加元数据标记...");
        documents.forEach(doc -> doc.getMetadata().put("cactusli", "知识库名称"));
        documentSplitterList.forEach(doc -> doc.getMetadata().put("cactusli", "知识库名称"));
        log.info("元数据添加完成");

        log.info("开始向PostgreSQL向量数据库写入文档...");
        pgVectorStore.accept(documentSplitterList);

        log.info("文档处理完成，共处理文档{}个，切分后文档{}个", documents.size(), documentSplitterList.size());
    }


    @Test
    public void ragChat() {
        String message = "请求CSDN发帖? 这几个字出现在哪个文件里？把这个方法完整输出！";
        log.info("用户提问: {}", message);

        String SYSTEM_PROMPT = """
                Use the information from the DOCUMENTS section to provide accurate answers but act as if you knew this information innately.
                If unsure, simply state that you don't know.
                Another thing you need to note is that your reply must be in Chinese!
                DOCUMENTS:
                    {documents}
                """;
        log.info("系统提示模板已设置");


        log.info("开始向量数据库相似度搜索，查询: {}", message);
        SearchRequest request = SearchRequest.builder().query(message).topK(5).filterExpression("cactusli == 'group-buy-market-liergou'").build();
        log.info("搜索参数: topK={}, 过滤条件={}", 5, "cactusli == '知识库名称'");

        List<Document> documents = pgVectorStore.similaritySearch(request);
        log.info("搜索完成，找到相关文档数量: {}", documents.size());

        for (int i = 0; i < documents.size(); i++) {
            log.info("文档[{}]内容片段: {}", i + 1, documents.get(i).getText().substring(0, Math.min(50, documents.get(i).getText().length())) + "...");
        }

        String documentsCollects = documents.stream().map(Document::getText).collect(Collectors.joining());
        log.info("合并文档总长度: {} 字符", documentsCollects);

        log.info("创建RAG系统消息...");
        Message ragMessage = new SystemPromptTemplate(SYSTEM_PROMPT).createMessage(Map.of("documents", documentsCollects));

        ArrayList<Message> messages = new ArrayList<>();
        messages.add(new UserMessage(message));
        messages.add(ragMessage);
        log.info("消息准备完成，共 {} 条消息", messages.size());

        log.info("开始调用Ollama模型 deepseek-r1:1.5b...");
        ChatResponse chatResponse = openAiChatModel.call(new Prompt(messages, ChatOptions.builder().model("gpt-4o-mini").build()));
        log.info("Ollama模型调用完成，返回消息: {}", chatResponse.getResult().getOutput().getText());

        log.info("完整响应: {}", JSON.toJSONString(chatResponse));
    }
}
