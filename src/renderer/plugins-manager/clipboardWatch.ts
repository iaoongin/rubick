import getCopyFiles from "@/common/utils/getCopyFiles";
import { clipboard, nativeImage, remote, ipcRenderer } from "electron";
import path from "path";
import pluginClickEvent from "./pluginClickEvent";
import { ref } from "vue";

export default ({ currentPlugin, optionsRef, openPlugin, setOptionsRef }) => {
  const clipboardFile: any = ref([]);
  const searchFocus = () => {
    const config = remote.getGlobal("OP_CONFIG").get();
    // 未开启自动粘贴
    if (!config.perf.common.autoPast) return;

    if (currentPlugin.value.name) return;
    const fileList = getCopyFiles();
    // 拷贝的是文件
    if (fileList) {
      window.setSubInputValue({ value: "" });
      clipboardFile.value = fileList;
      const localPlugins = remote.getGlobal("LOCAL_PLUGINS").getLocalPlugins();
      const options: any = [
        {
          name: "复制路径",
          value: "plugin",
          icon: require("../assets/link.png"),
          desc: "复制路径到剪切板",
          click: () => {
            clipboard.writeText(fileList.map((file) => file.path).join(","));
            ipcRenderer.send("msg-trigger", { type: "hideMainWindow" });
          },
        },
      ];
      // 判断复制的文件类型是否一直
      const commonLen = fileList.filter(
        (file) => path.extname(fileList[0].path) === path.extname(file.path)
      ).length;
      // 复制路径
      if (commonLen !== fileList.length) {
        setOptionsRef(options);
        return;
      }

      // 再正则插件
      localPlugins.forEach((plugin) => {
        const feature = plugin.features;
        // 系统插件无 features 的情况，不需要再搜索
        if (!feature) return;
        feature.forEach((fe) => {
          const ext = path.extname(fileList[0].path);
          fe.cmds.forEach((cmd) => {
            const regImg = /\.(png|jpg|gif|jpeg|webp)$/;
            if (
              cmd.type === "img" &&
              regImg.test(ext) &&
              fileList.length === 1
            ) {
              options.push({
                name: cmd.label,
                value: "plugin",
                icon: plugin.logo,
                desc: fe.explain,
                type: plugin.pluginType,
                click: () => {
                  pluginClickEvent({
                    plugin,
                    fe,
                    cmd,
                    ext: {
                      code: fe.code,
                      type: cmd.type || "text",
                      payload: nativeImage
                        .createFromPath(fileList[0].path)
                        .toDataURL(),
                    },
                    openPlugin,
                  });
                  clearClipboardFile();
                },
              });
            }
            // 如果是文件，且符合文件正则类型
            if (
              fileList.length > 1 ||
              (cmd.type === "file" && new RegExp(cmd.match).test(ext))
            ) {
              options.push({
                name: cmd,
                value: "plugin",
                icon: plugin.logo,
                desc: fe.explain,
                type: plugin.pluginType,
                click: () => {
                  pluginClickEvent({
                    plugin,
                    fe,
                    cmd,
                    ext: {
                      code: fe.code,
                      type: cmd.type || "text",
                      payload: fileList,
                    },
                    openPlugin,
                  });
                  clearClipboardFile();
                },
              });
            }
          });
        });
      });

      setOptionsRef(options);
      clipboard.clear();
      return;
    }
    const clipboardType = clipboard.availableFormats();
    if (!clipboardType.length) return;
    if ("text/plain" === clipboardType[0]) {
      const contentText = clipboard.readText();
      if (contentText.trim()) {
        clearClipboardFile();
        window.setSubInputValue({ value: contentText });
      }
      clipboard.clear();
    }
  };

  const clearClipboardFile = () => {
    clipboardFile.value = [];
    optionsRef.value = [];
  };
  // 触发 ctrl + v 主动粘贴时
  const readClipboardContent = () => {
    // read image
    const img = clipboard.readImage();
    const dataUrl = img.toDataURL();
    if (!dataUrl.replace("data:image/png;base64,", "")) return;
    clipboardFile.value = [
      {
        isFile: true,
        isDirectory: false,
        path: null,
        dataUrl,
      },
    ];
    const localPlugins = remote.getGlobal("LOCAL_PLUGINS").getLocalPlugins();
    const options: any = [];
    // 再正则插件
    localPlugins.forEach((plugin) => {
      const feature = plugin.features;
      // 系统插件无 features 的情况，不需要再搜索
      if (!feature) return;
      feature.forEach((fe) => {
        fe.cmds.forEach((cmd) => {
          if (cmd.type === "img") {
            options.push({
              name: cmd.label,
              value: "plugin",
              icon: plugin.logo,
              desc: fe.explain,
              type: plugin.pluginType,
              click: () => {
                pluginClickEvent({
                  plugin,
                  fe,
                  cmd,
                  ext: {
                    code: fe.code,
                    type: cmd.type || "text",
                    payload: dataUrl,
                  },
                  openPlugin,
                });
                clearClipboardFile();
              },
            });
          }
        });
      });

      setOptionsRef(options);
    });
  };

  return {
    searchFocus,
    clipboardFile,
    clearClipboardFile,
    readClipboardContent,
  };
};
