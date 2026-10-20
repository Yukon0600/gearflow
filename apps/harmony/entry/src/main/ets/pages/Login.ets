import { router } from '@kit.ArkUI';
import { Api } from '../common/Api';

@Entry
@Component
struct Login {
  @State username: string = 'admin';
  @State password: string = '';
  @State busy: boolean = false;
  @State error: string = '';

  private async doLogin(): Promise<void> {
    if (this.username.trim().length === 0 || this.password.length === 0) {
      this.error = '请输入账号和密码';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      await Api.login(this.username.trim(), this.password);
      router.replaceUrl({ url: 'pages/Stock' });
    } catch (err) {
      this.error = '登录失败：' + (err as Error).message;
    } finally {
      this.busy = false;
    }
  }

  build() {
    Column({ space: 16 }) {
      Text('GEARFLOW').fontSize(12).fontColor('#A99BFF').letterSpacing(2)
      Text('进销存移动端').fontSize(30).fontWeight(FontWeight.Bold).fontColor('#F2F4F8')
      Text('库存查询 · 扫码盘点').fontSize(13).fontColor('#8B90A0').margin({ bottom: 16 })

      Column({ space: 12 }) {
        Text('账号').fontSize(12).fontColor('#9AA0B0').width('100%')
        TextInput({ placeholder: '请输入账号', text: this.username })
          .height(48)
          .backgroundColor('#12141A')
          .fontColor('#E8EAF0')
          .onChange((value: string) => { this.username = value })

        Text('密码').fontSize(12).fontColor('#9AA0B0').width('100%').margin({ top: 8 })
        TextInput({ placeholder: '请输入密码', text: this.password })
          .type(InputType.Password)
          .height(48)
          .backgroundColor('#12141A')
          .fontColor('#E8EAF0')
          .onChange((value: string) => { this.password = value })

        if (this.error.length > 0) {
          Text(this.error).fontSize(12).fontColor('#FF7A7A').width('100%').margin({ top: 4 })
        }

        Button(this.busy ? '正在登录…' : '登录')
          .width('100%')
          .height(46)
          .margin({ top: 16 })
          .enabled(!this.busy)
          .backgroundColor('#7C6CF0')
          .onClick(() => { this.doLogin(); })

        Text('登录状态有效期 8 小时').fontSize(11).fontColor('#6B7080').margin({ top: 8 })
      }
      .padding(20)
      .backgroundColor('#171A21')
      .borderRadius(16)
      .width('100%')

      Blank()
    }
    .width('100%')
    .height('100%')
    .padding({ left: 24, right: 24, top: 80 })
    .backgroundColor('#0D0E12')
  }
}
