package cn.cactusli.lxf.rag.api.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * Package: cn.cactusli.lxf.rag.api.response
 * Description:
 *
 * @Author 仙人球⁶ᴳ |
 * @Date 2025/3/12 15:46
 * @Github https://github.com/lixuanfengs
 */

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Response<T> implements Serializable {

    private String code;
    private String info;
    private T data;

}
