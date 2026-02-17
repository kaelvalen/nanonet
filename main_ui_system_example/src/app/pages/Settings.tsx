import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Settings as SettingsIcon, Bell, Shield, Palette, Save } from "lucide-react";

export function Settings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-pink-600 bg-clip-text text-transparent">
          Ayarlar
        </h1>
        <p className="text-gray-600 mt-1">Platform ayarlarınızı yönetin</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-white/60 backdrop-blur-lg border border-cyan-200">
          <TabsTrigger value="general">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Genel
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Bildirimler
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Güvenlik
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="w-4 h-4 mr-2" />
            Görünüm
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card className="bg-white/60 backdrop-blur-lg border-cyan-200">
            <CardHeader>
              <CardTitle className="text-cyan-900">Platform Ayarları</CardTitle>
              <CardDescription>Temel platform yapılandırması</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="platform-name">Platform Adı</Label>
                <Input
                  id="platform-name"
                  defaultValue="ANONET"
                  className="bg-white border-cyan-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-endpoint">API Endpoint</Label>
                <Input
                  id="api-endpoint"
                  defaultValue="https://api.anonet.com"
                  className="bg-white border-cyan-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refresh-rate">Yenileme Aralığı (saniye)</Label>
                <Input
                  id="refresh-rate"
                  type="number"
                  defaultValue="30"
                  className="bg-white border-cyan-200"
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200">
                <div className="space-y-0.5">
                  <Label>Otomatik Yenileme</Label>
                  <p className="text-sm text-gray-600">Metrikleri otomatik olarak güncelle</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200">
                <div className="space-y-0.5">
                  <Label>Gelişmiş Metrikler</Label>
                  <p className="text-sm text-gray-600">Detaylı performans metriklerini göster</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
                <Save className="w-4 h-4 mr-2" />
                Değişiklikleri Kaydet
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card className="bg-white/60 backdrop-blur-lg border-pink-200">
            <CardHeader>
              <CardTitle className="text-pink-900">Bildirim Tercihleri</CardTitle>
              <CardDescription>Hangi bildirimleri almak istediğinizi seçin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200">
                <div className="space-y-0.5">
                  <Label>Servis Hataları</Label>
                  <p className="text-sm text-gray-600">Servis hatalarında bildirim al</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200">
                <div className="space-y-0.5">
                  <Label>Performans Uyarıları</Label>
                  <p className="text-sm text-gray-600">Yüksek kaynak kullanımında uyar</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200">
                <div className="space-y-0.5">
                  <Label>Servis Güncellemeleri</Label>
                  <p className="text-sm text-gray-600">Yeni servis versiyonları için bildirim</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200">
                <div className="space-y-0.5">
                  <Label>Günlük Raporlar</Label>
                  <p className="text-sm text-gray-600">Günlük özet raporları al</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-posta Adresi</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="miku@anonet.com"
                  className="bg-white border-pink-200"
                />
              </div>
              <Button className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600">
                <Save className="w-4 h-4 mr-2" />
                Kaydet
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-4">
          <Card className="bg-white/60 backdrop-blur-lg border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-900">Güvenlik Ayarları</CardTitle>
              <CardDescription>Platform güvenliğini yönetin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200">
                <div className="space-y-0.5">
                  <Label>İki Faktörlü Doğrulama</Label>
                  <p className="text-sm text-gray-600">Ekstra güvenlik katmanı ekle</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200">
                <div className="space-y-0.5">
                  <Label>API Token Rotasyonu</Label>
                  <p className="text-sm text-gray-600">Tokenları otomatik olarak yenile</p>
                </div>
                <Switch />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  defaultValue="anonet_sk_1234567890"
                  className="bg-white border-purple-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://your-webhook.com/events"
                  className="bg-white border-purple-200"
                />
              </div>
              <Button className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600">
                <Save className="w-4 h-4 mr-2" />
                Güvenlik Ayarlarını Kaydet
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-4">
          <Card className="bg-white/60 backdrop-blur-lg border-cyan-200">
            <CardHeader>
              <CardTitle className="text-cyan-900">Görünüm Ayarları</CardTitle>
              <CardDescription>Miku & Cinnamoroll teması</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Tema Renkleri</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-200 border-2 border-cyan-400 cursor-pointer hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-400"></div>
                      <span className="font-medium text-cyan-900">Hatsune Miku</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-100 to-pink-100 border-2 border-blue-300 cursor-pointer hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-300"></div>
                      <span className="font-medium text-blue-900">Cinnamoroll</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-pink-50 border border-cyan-200">
                <div className="space-y-0.5">
                  <Label>Animasyonlu Arkaplan</Label>
                  <p className="text-sm text-gray-600">Gradient animasyonlarını göster</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-pink-50 border border-cyan-200">
                <div className="space-y-0.5">
                  <Label>Karakter Görselleri</Label>
                  <p className="text-sm text-gray-600">Miku & Cinnamoroll dekorasyonları</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-pink-50 border border-cyan-200">
                <div className="space-y-0.5">
                  <Label>Parıltı Efektleri</Label>
                  <p className="text-sm text-gray-600">✨ Sevimli parıltı animasyonları</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
                <Save className="w-4 h-4 mr-2" />
                Görünüm Ayarlarını Kaydet
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
