/**
 * 由 scripts/import-presenton.mjs 自动生成，**请勿手改**。
 *
 * 来源：presenton/presenton（Apache-2.0），只导入配色与字体性格，未导入其元素树。
 * 重新生成：node scripts/import-presenton.mjs
 * 许可证与署名登记：docs/03-素材来源.csv
 */
import type { ThemeTokens } from "@/lib/ir/schema";
import type { CompositionId } from "@/lib/layout/compositions";

export interface ImportedTheme {
  id: string;
  name: string;
  description: string;
  tone: "light" | "dark";
  composition: CompositionId;
  tokens: Omit<ThemeTokens, "fonts"> & {
    fonts: { zh: string; en: string; mono: string; display?: string; serif?: boolean; ultraBold?: boolean };
  };
  source: { project: string; license: string; path: string };
}

export const IMPORTED_THEMES: ImportedTheme[] = [
  {
    "id": "presenton-editorial",
    "name": "导入·编辑",
    "description": "导入自 presenton（Apache-2.0）的 editorial 配色与字体性格",
    "tone": "dark",
    "composition": "editorial",
    "tokens": {
      "colors": {
        "primary": "155F99",
        "secondary": "2075BC",
        "accent": "9DCAEA",
        "background": "1D242D",
        "surface": "1DA1F2",
        "onPrimary": "FFFFFF",
        "sectionBg": "13171D",
        "onSection": "FFFFFF",
        "text1": "FFFFFF",
        "text2": "A9ACAF",
        "text3": "73777D"
      },
      "fonts": {
        "zh": "DengXian",
        "en": "Arial",
        "mono": "Consolas",
        "display": "SimSun",
        "serif": true,
        "ultraBold": false
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 2,
      "border": {
        "width": 1,
        "color": "FFFFFF"
      },
      "lineHeight": {
        "title": 1.28,
        "body": 1.6
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/editorial/template.json"
    }
  },
  {
    "id": "presenton-nova",
    "name": "导入·新星",
    "description": "导入自 presenton（Apache-2.0）的 nova 配色与字体性格",
    "tone": "light",
    "composition": "card",
    "tokens": {
      "colors": {
        "primary": "2862A2",
        "secondary": "2862A2",
        "accent": "AFC3DA",
        "background": "FFFFFF",
        "surface": "F5F6F6",
        "onPrimary": "FFFFFF",
        "sectionBg": "23568F",
        "onSection": "FFFFFF",
        "text1": "000000",
        "text2": "616161",
        "text3": "9E9E9E"
      },
      "fonts": {
        "zh": "Microsoft YaHei",
        "en": "Arial",
        "mono": "Consolas",
        "display": "Microsoft YaHei",
        "serif": false,
        "ultraBold": true
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "D9D9D9"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/nova/template.json"
    }
  },
  {
    "id": "presenton-mosaic",
    "name": "导入·马赛克",
    "description": "导入自 presenton（Apache-2.0）的 mosaic 配色与字体性格",
    "tone": "light",
    "composition": "card",
    "tokens": {
      "colors": {
        "primary": "7C6AF4",
        "secondary": "7C6AF4",
        "accent": "7563ED",
        "background": "FFFFFF",
        "surface": "FBFBFB",
        "onPrimary": "FFFFFF",
        "sectionBg": "6D5DD7",
        "onSection": "1A1919",
        "text1": "1A1919",
        "text2": "717070",
        "text3": "A8A8A8"
      },
      "fonts": {
        "zh": "Microsoft YaHei",
        "en": "Arial",
        "mono": "Consolas",
        "display": "Microsoft YaHei",
        "serif": false,
        "ultraBold": false
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "000000"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/mosaic/template.json"
    }
  },
  {
    "id": "presenton-pulse",
    "name": "导入·脉搏",
    "description": "导入自 presenton（Apache-2.0）的 pulse 配色与字体性格",
    "tone": "light",
    "composition": "band",
    "tokens": {
      "colors": {
        "primary": "18324A",
        "secondary": "71A9FE",
        "accent": "4B6175",
        "background": "FFFFFF",
        "surface": "C6DDFF",
        "onPrimary": "FFFFFF",
        "sectionBg": "152C41",
        "onSection": "FFFFFF",
        "text1": "18324A",
        "text2": "70808F",
        "text3": "A7B1BA"
      },
      "fonts": {
        "zh": "Microsoft YaHei",
        "en": "Arial",
        "mono": "Consolas",
        "display": "Microsoft YaHei",
        "serif": false,
        "ultraBold": false
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "C8D1D9"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/pulse/template.json"
    }
  },
  {
    "id": "presenton-civic",
    "name": "导入·公民",
    "description": "导入自 presenton（Apache-2.0）的 civic 配色与字体性格",
    "tone": "light",
    "composition": "band",
    "tokens": {
      "colors": {
        "primary": "000000",
        "secondary": "000000",
        "accent": "BDBDBD",
        "background": "ECECEC",
        "surface": "DDDDDD",
        "onPrimary": "FFFFFF",
        "sectionBg": "000000",
        "onSection": "FFFFFF",
        "text1": "000000",
        "text2": "5A5A5A",
        "text3": "929292"
      },
      "fonts": {
        "zh": "Microsoft YaHei",
        "en": "Arial",
        "mono": "Consolas",
        "display": "Microsoft YaHei",
        "serif": false,
        "ultraBold": false
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "8E8E8E"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/civic/template.json"
    }
  },
  {
    "id": "presenton-executive",
    "name": "导入·高管",
    "description": "导入自 presenton（Apache-2.0）的 executive 配色与字体性格",
    "tone": "light",
    "composition": "card",
    "tokens": {
      "colors": {
        "primary": "8554EB",
        "secondary": "A386EA",
        "accent": "8958F4",
        "background": "F8F7FB",
        "surface": "F0EEF8",
        "onPrimary": "FFFFFF",
        "sectionBg": "754ACF",
        "onSection": "FFFFFF",
        "text1": "000000",
        "text2": "5E5E5F",
        "text3": "9A999C"
      },
      "fonts": {
        "zh": "Microsoft YaHei",
        "en": "Arial",
        "mono": "Consolas",
        "display": "Microsoft YaHei",
        "serif": false,
        "ultraBold": true
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "9081C8"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/executive/template.json"
    }
  },
  {
    "id": "presenton-landmark",
    "name": "导入·地标",
    "description": "导入自 presenton（Apache-2.0）的 landmark 配色与字体性格",
    "tone": "light",
    "composition": "band",
    "tokens": {
      "colors": {
        "primary": "E60904",
        "secondary": "E60904",
        "accent": "E86666",
        "background": "F7F5F3",
        "surface": "FFFFFF",
        "onPrimary": "FFFFFF",
        "sectionBg": "CA0804",
        "onSection": "FFFFFF",
        "text1": "000000",
        "text2": "5E5D5C",
        "text3": "999897"
      },
      "fonts": {
        "zh": "Microsoft YaHei",
        "en": "Arial",
        "mono": "Consolas",
        "display": "Microsoft YaHei",
        "serif": false,
        "ultraBold": true
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "D9E1E1"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/landmark/template.json"
    }
  },
  {
    "id": "presenton-momentum",
    "name": "导入·动能",
    "description": "导入自 presenton（Apache-2.0）的 momentum 配色与字体性格",
    "tone": "light",
    "composition": "band",
    "tokens": {
      "colors": {
        "primary": "213EBB",
        "secondary": "4F68C4",
        "accent": "2745BF",
        "background": "F6F7FC",
        "surface": "FFFFFF",
        "onPrimary": "FFFFFF",
        "sectionBg": "1D37A5",
        "onSection": "FFFFFF",
        "text1": "000000",
        "text2": "5D5E60",
        "text3": "99999C"
      },
      "fonts": {
        "zh": "Microsoft YaHei",
        "en": "Arial",
        "mono": "Consolas",
        "display": "Microsoft YaHei",
        "serif": false,
        "ultraBold": true
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "1A3DB3"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/momentum/template.json"
    }
  },
  {
    "id": "presenton-horizon",
    "name": "导入·地平线",
    "description": "导入自 presenton（Apache-2.0）的 horizon 配色与字体性格",
    "tone": "light",
    "composition": "card",
    "tokens": {
      "colors": {
        "primary": "A65300",
        "secondary": "A65300",
        "accent": "B8894F",
        "background": "F8FAFC",
        "surface": "F0DFCC",
        "onPrimary": "FFFFFF",
        "sectionBg": "924900",
        "onSection": "FFFFFF",
        "text1": "321A00",
        "text2": "7D6F60",
        "text3": "ADA59C"
      },
      "fonts": {
        "zh": "DengXian",
        "en": "Arial",
        "mono": "Consolas",
        "display": "DengXian",
        "serif": false,
        "ultraBold": true
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "C49A6C"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/horizon/template.json"
    }
  },
  {
    "id": "presenton-signal",
    "name": "导入·信号",
    "description": "导入自 presenton（Apache-2.0）的 signal 配色与字体性格",
    "tone": "light",
    "composition": "card",
    "tokens": {
      "colors": {
        "primary": "E1BB80",
        "secondary": "E1BB80",
        "accent": "B8C7E5",
        "background": "FFFFFF",
        "surface": "FBE9EF",
        "onPrimary": "1D1311",
        "sectionBg": "C6A571",
        "onSection": "1D1311",
        "text1": "1D1311",
        "text2": "736D6B",
        "text3": "A9A5A5"
      },
      "fonts": {
        "zh": "Microsoft YaHei",
        "en": "Arial",
        "mono": "Consolas",
        "display": "Microsoft YaHei",
        "serif": false,
        "ultraBold": true
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "B8A49A"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/signal/template.json"
    }
  },
  {
    "id": "presenton-modern",
    "name": "导入·现代",
    "description": "导入自 presenton（Apache-2.0）的 modern 配色与字体性格",
    "tone": "light",
    "composition": "card",
    "tokens": {
      "colors": {
        "primary": "F59E0B",
        "secondary": "3B82F6",
        "accent": "234CD9",
        "background": "F5F8FE",
        "surface": "FFFFFF",
        "onPrimary": "334155",
        "sectionBg": "D88B0A",
        "onSection": "234CD9",
        "text1": "234CD9",
        "text2": "738DE7",
        "text3": "A5B7F0"
      },
      "fonts": {
        "zh": "Microsoft YaHei",
        "en": "Arial",
        "mono": "Consolas",
        "display": "Microsoft YaHei",
        "serif": false,
        "ultraBold": false
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "E5E7EB"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/modern/template.json"
    }
  },
  {
    "id": "presenton-dynamic",
    "name": "导入·动感",
    "description": "导入自 presenton（Apache-2.0）的 dynamic 配色与字体性格",
    "tone": "dark",
    "composition": "rail",
    "tokens": {
      "colors": {
        "primary": "C24D12",
        "secondary": "FF9257",
        "accent": "983608",
        "background": "171717",
        "surface": "000000",
        "onPrimary": "FFFFFF",
        "sectionBg": "0F0F0F",
        "onSection": "FFFFFF",
        "text1": "FFFFFF",
        "text2": "A7A7A7",
        "text3": "6F6F6F"
      },
      "fonts": {
        "zh": "Microsoft YaHei",
        "en": "Arial",
        "mono": "Consolas",
        "display": "Microsoft YaHei",
        "serif": false,
        "ultraBold": false
      },
      "rhythm": {
        "unit": 8,
        "sectionGap": 32
      },
      "radius": 10,
      "border": {
        "width": 1,
        "color": "FFFFFF"
      },
      "lineHeight": {
        "title": 1.2,
        "body": 1.5
      }
    },
    "source": {
      "project": "presenton/presenton",
      "license": "Apache-2.0",
      "path": "templates/dynamic/template.json"
    }
  }
];
