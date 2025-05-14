package cn.cactusli.lxf.rag.trigger.http;

import cn.cactusli.lxf.rag.api.IAiService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.SystemPromptTemplate;
import org.springframework.ai.document.Document;
import org.springframework.ai.ollama.api.OllamaOptions;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Package: cn.cactusli.lxf.rag.trigger.http
 * Description:
 *
 * @Author 仙人球⁶ᴳ |
 * @Date 2025/4/14 16:03
 * @Github https://github.com/lixuanfengs
 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/v1/openai")
public class OpenAiController implements IAiService {

    @Resource
    private OpenAiChatModel openAiChatModel;

    @Resource
    private PgVectorStore pgVectorStore;

    @Resource
    private ObjectMapper objectMapper;

    /**
     * http://localhost:7080/api/v1/openai/generate?model=deepseek-r1:1.5b&message=你是？
     */
    @GetMapping("generate")
    @Override
    public ChatResponse generate(@RequestParam("model") String model, @RequestParam("message") String message) {
        return openAiChatModel.call(new Prompt(
                message,
                OllamaOptions.builder()
                        .model(model)
                        .build()
        ));
    }


    /**
     * http://localhost:7080/api/v1/openai/generate_stream?model=deepseek-r1:1.5b&message=你是？
     */
    @GetMapping("generate_stream")
    @Override
    public Flux<ChatResponse> generateStream(
            @RequestParam("model") String model,
            @RequestParam("message") String currentMessage, // 为了清晰，重命名一下
            @RequestParam(name = "history", required = false, defaultValue = "[]") String history // 接收 history JSON 字符串
    ) {
        List<Message> conversation = new ArrayList<>(); // 用于存储完整对话的列表

        // 尝试解析 history JSON
        try {
            // 将 JSON 字符串解析为 Map 列表，每个 Map 代表一条消息
            List<Map<String, String>> historyList = objectMapper.readValue(history, new TypeReference<List<Map<String, String>>>() {});
            for (Map<String, String> msg : historyList) {
                // 根据 'role' 创建相应的 Message 对象
                if ("user".equalsIgnoreCase(msg.get("role"))) {
                    conversation.add(new UserMessage(msg.get("content")));
                } else if ("assistant".equalsIgnoreCase(msg.get("role"))) {
                    // 如果历史记录中保存了 <think> 标签，也一并包含
                    conversation.add(new AssistantMessage(msg.get("content")));
                }
            }
        } catch (Exception e) {
            // 记录错误或处理无效的 history JSON - 可以考虑返回一个错误的 Flux？
            System.err.println("解析聊天历史 JSON 时出错: " + e.getMessage());
            // 为简单起见，如果解析失败，则在没有历史记录的情况下继续
        }

        // 添加当前用户发送的消息
        conversation.add(new UserMessage(currentMessage));

        // 使用完整的对话历史创建 Prompt
        Prompt prompt = new Prompt(
                conversation, // 传入包含所有消息的 List<Message>
                OllamaOptions.builder()
                        .model(model)
                        .build()
        );

        // 将包含完整对话的 Prompt 发送给模型
        return openAiChatModel.stream(prompt);
    }

    @GetMapping(value = "generate_stream_rag")
    @Override
    public Flux<ChatResponse> generateStreamRag(@RequestParam("model") String model, @RequestParam("ragTag") String ragTag, @RequestParam("message") String message) {

        String SYSTEM_PROMPT = """
                Use the information from the DOCUMENTS section to provide accurate answers but act as if you knew this information innately.
                If unsure, simply state that you don't know.
                Another thing you need to note is that your reply must be in Chinese!
                DOCUMENTS:
                    {documents}
                """;
        // 指定文档搜索
        SearchRequest request = SearchRequest.builder()
                .query(message)
                .topK(5)
                .filterExpression("cactusli == '" + ragTag + "'")
                .build();

        List<Document> documents = pgVectorStore.similaritySearch(request);
        String documentCollectors = documents.stream().map(Document::getText).collect(Collectors.joining());
        Message ragMessage = new SystemPromptTemplate(SYSTEM_PROMPT).createMessage(Map.of("documents", documentCollectors));

        // 组装消息
        ArrayList<Message> messages = new ArrayList<>();
        messages.add(new UserMessage(message));
        messages.add(ragMessage);

        return openAiChatModel.stream(new Prompt(
                messages,
                OllamaOptions.builder()
                        .model(model)
                        .build()
        ));
    }


}
