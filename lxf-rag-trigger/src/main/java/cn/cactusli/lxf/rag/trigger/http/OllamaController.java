package cn.cactusli.lxf.rag.trigger.http;

import cn.cactusli.lxf.rag.api.IAiService;
import jakarta.annotation.Resource;;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.SystemPromptTemplate;
import org.springframework.ai.document.Document;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaOptions;
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
 * @Date 2025/3/14 14:42
 * @Github https://github.com/lixuanfengs
 */
@RestController
@CrossOrigin({"*"})
@RequestMapping("/api/v1/ollama/")
public class OllamaController implements IAiService {

    @Resource
    private OllamaChatModel chatModel;

    @Resource
    private PgVectorStore pgVectorStore;

    /**
     * http://localhost:7080/api/v1/ollama/generate?model=deepseek-r1:1.5b&message=你是？
     */
    @GetMapping("generate")
    @Override
    public ChatResponse generate(@RequestParam String model, @RequestParam String message) {
        return chatModel.call(new Prompt(message, OllamaOptions.builder().model(model).build()));
    }

    /**
     * http://localhost:7080/api/v1/ollama/generate_stream?model=deepseek-r1:1.5b&message=你是？
     */
    @GetMapping("generate_stream")
    @Override
    public Flux<ChatResponse> generateStream(@RequestParam String model, @RequestParam String message) {
        return chatModel.stream(new Prompt(message, OllamaOptions.builder().model(model).build()));
    }

    @GetMapping(value = "generate_stream_rag")
    @Override
    public Flux<ChatResponse> generateStreamRag(@RequestParam String model, @RequestParam String ragTag, @RequestParam String message) {
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

        return chatModel.stream(new Prompt(
                messages,
                OllamaOptions.builder()
                        .model(model)
                        .build())
        );
    }
}
