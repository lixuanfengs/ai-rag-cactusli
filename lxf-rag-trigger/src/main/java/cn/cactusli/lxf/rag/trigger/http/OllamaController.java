package cn.cactusli.lxf.rag.trigger.http;

import cn.cactusli.lxf.rag.api.IAiService;
import jakarta.annotation.Resource;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaOptions;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

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
}
