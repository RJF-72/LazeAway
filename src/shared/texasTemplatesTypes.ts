export interface TexasTemplate {
  id: number
  name: string
  subtitle: string
  complexity: string
  material: string
  type: 'cut' | 'engrave' | 'inlay' | 'ornate' | string
  detail: string
}
export type TexasTemplates = TexasTemplate[]
