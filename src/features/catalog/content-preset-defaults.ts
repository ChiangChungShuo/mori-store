export type ContentPresetKind = 'material' | 'care' | 'size'

export const defaultMaterialPresets = [
  '100% 純棉',
  '有機棉',
  '棉 95% / 彈性纖維 5%',
  '天絲 TENCEL',
]

export const defaultCarePresets = [
  '冷水手洗或機洗，請勿漂白',
  '低溫烘乾或平放晾乾',
  '翻面洗滌，避免陽光直曬',
  '深淺色分開洗滌',
]

export const defaultSizePresets = ['80', '90', '100', '110', '120', '130', '140']

export const contentPresetDefaults: Record<ContentPresetKind, string[]> = {
  material: defaultMaterialPresets,
  care: defaultCarePresets,
  size: defaultSizePresets,
}

export const contentPresetLabels: Record<ContentPresetKind, string> = {
  material: '常用材質',
  care: '常用洗滌說明',
  size: '尺寸選項',
}
