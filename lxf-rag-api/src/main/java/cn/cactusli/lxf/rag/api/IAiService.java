package cn.cactusli.lxf.rag.api;

import org.springframework.ai.chat.model.ChatResponse;
import reactor.core.publisher.Flux;

/**
 * Package: cn.cactusli.lxf.rag.api
 * Description:
 *
 * @Author 仙人球⁶ᴳ |
 * @Date 2025/3/12 15:52
 * @Github https://github.com/lixuanfengs
 */
public interface IAiService {

    ChatResponse generate(String model, String message);

    Flux<ChatResponse> generateStream(String model, String message);

    Flux<ChatResponse> generateStreamRag(String model, String ragTag, String message);

}
