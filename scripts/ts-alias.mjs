/** 注册 TS 解析钩子（供 node --import 使用） */
import { register } from "node:module";

register("./ts-resolve-hooks.mjs", import.meta.url);
