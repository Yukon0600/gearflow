import { router } from '@kit.ArkUI';
import { Api, Product } from '../common/Api';

@Entry
@Component
struct Stock {
  @State products: Product[] = [];
  @State keyword: string = '';
  @State total: number = 0;
  @State lowCount: number = 0;
  @State loading: boolean = false;
  @State error: string = '';

  aboutToAppear(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const data = await Api.stock();
      this.products = data.products;
      this.total = data.total;
      this.lowCount = data.lowCount;
    } catch (err) {
      this.error = '加载失败：' + (err as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private filtered(): Product[] {
    const key: string = this.keyword.trim().toLowerCase();
    if (key.length === 0) {
      return this.products;
    }
    return this.products.filter((item: Product) =>
      item.name.toLowerCase().includes(key) ||
      item.sku.toLowerCase().includes(key) ||
      item.brand.toLowerCase().includes(key));
  }

  private formatPrice(value: number): string {
    return (value / 100).toFixed(2);
  }

  build() {
    Column() {
      Column({ space: 6 }) {
        Text('库存').fontSize(24).fontWeight(FontWeight.Bold).fontColor('#F2F4F8')
        Row({ space: 16 }) {
          Text('商品 ' + this.total.toString()).fontSize(12).fontColor('#8B90A0')
          Text('低于阈值 ' + this.lowCount.toString()).fontSize(12).fontColor('#FFB454')
          Blank()
          Text('刷新').fontSize(12).fontColor('#A99BFF')
            .onClick(() => { this.load(); })
          Text('退出').fontSize(12).fontColor('#8B90A0')
            .onClick(() => { router.replaceUrl({ url: 'pages/Login' }); })
        }
        .width('100%')
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 16, bottom: 12 })

      TextInput({ placeholder: '搜索名称 / SKU / 品牌', text: this.keyword })
        .height(40)
        .margin({ left: 20, right: 20, bottom: 8 })
        .backgroundColor('#12141A')
        .fontColor('#E8EAF0')
        .onChange((value: string) => { this.keyword = value })

      if (this.error.length > 0) {
        Text(this.error).fontSize(12).fontColor('#FF7A7A')
          .width('100%').padding({ left: 20, right: 20, bottom: 8 })
      }

      if (this.loading) {
        Text('加载中…').fontSize(13).fontColor('#8B90A0').margin({ top: 40 })
      } else if (this.filtered().length === 0) {
        Text('没有匹配的商品').fontSize(13).fontColor('#8B90A0').margin({ top: 40 })
      } else {
        List({ space: 10 }) {
          ForEach(this.filtered(), (item: Product) => {
            ListItem() {
              Row() {
                Column({ space: 4 }) {
                  Text(item.name).fontSize(15).fontColor('#EEF0F6').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                  Text(item.sku + ' · ' + item.brand).fontSize(11).fontColor('#7D8394')
                  Text('¥' + this.formatPrice(item.price)).fontSize(11).fontColor('#7D8394')
                }
                .alignItems(HorizontalAlign.Start)
                .layoutWeight(1)

                Column({ space: 2 }) {
                  Text(item.stock.toString())
                    .fontSize(20)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(item.low ? '#FFB454' : '#7CE0B8')
                  Text('件').fontSize(10).fontColor('#7D8394')
                }
                .margin({ left: 12 })
              }
              .width('100%')
              .padding(14)
              .backgroundColor('#171A21')
              .borderRadius(12)
            }
          }, (item: Product) => item.id)
        }
        .width('100%')
        .padding({ left: 20, right: 20 })
        .layoutWeight(1)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#0D0E12')
  }
}
