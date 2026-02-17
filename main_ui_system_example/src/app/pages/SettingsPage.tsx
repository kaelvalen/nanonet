import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Settings, Bell, Key, Users } from "lucide-react";
import { motion } from "motion/react";

export function SettingsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="relative">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#93c5fd] via-[#c4b5fd] to-[#fda4af] bg-clip-text text-transparent">
          Settings
        </h1>
        <div className="text-[10px] text-[#7c8db5] mt-1 flex items-center gap-2">
          <Settings className="w-3 h-3 text-[#93c5fd]" />
          Platform configuration
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-white/80 border border-[#39c5bb]/15 rounded-xl">
          <TabsTrigger value="general" className="text-xs data-[state=active]:bg-[#39c5bb]/10 data-[state=active]:text-[#2da89e] gap-1.5 rounded-lg">
            <Settings className="w-3 h-3" /> General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs data-[state=active]:bg-[#39c5bb]/10 data-[state=active]:text-[#2da89e] gap-1.5 rounded-lg">
            <Bell className="w-3 h-3" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="api" className="text-xs data-[state=active]:bg-[#39c5bb]/10 data-[state=active]:text-[#2da89e] gap-1.5 rounded-lg">
            <Key className="w-3 h-3" /> API
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs data-[state=active]:bg-[#39c5bb]/10 data-[state=active]:text-[#2da89e] gap-1.5 rounded-lg">
            <Users className="w-3 h-3" /> Team
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-[#3b4563]">Project Settings</CardTitle>
              <CardDescription className="text-[#7c8db5] text-xs">Configure project details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="project-name" className="text-[#3b4563] text-xs">Project Name</Label>
                <Input id="project-name" defaultValue="NanoNet" className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-url" className="text-[#3b4563] text-xs">Project URL</Label>
                <Input id="project-url" defaultValue="https://nanonet.dev" className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
              </div>
              <Separator className="bg-[#39c5bb]/10" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[#3b4563] text-xs">Auto Refresh</Label>
                  <p className="text-[10px] text-[#7c8db5]">Automatically update metrics</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[#3b4563] text-xs">Floating Shapes</Label>
                  <p className="text-[10px] text-[#7c8db5]">Show pastel background animation</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button className="mt-4 bg-gradient-to-r from-[#39c5bb] to-[#93c5fd] text-white text-xs rounded-xl">Save Changes</Button>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-[#3b4563]">Polling Settings</CardTitle>
              <CardDescription className="text-[#7c8db5] text-xs">Configure monitoring intervals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="polling-interval" className="text-[#3b4563] text-xs">Default Polling Interval (seconds)</Label>
                <Input id="polling-interval" type="number" defaultValue="10" className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timeout" className="text-[#3b4563] text-xs">Timeout (seconds)</Label>
                <Input id="timeout" type="number" defaultValue="30" className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
              </div>
              <Button className="mt-4 bg-gradient-to-r from-[#39c5bb] to-[#93c5fd] text-white text-xs rounded-xl">Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-[#3b4563]">Notification Preferences</CardTitle>
              <CardDescription className="text-[#7c8db5] text-xs">Choose which notifications to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[#3b4563] text-xs">Service Down Alerts</Label>
                  <p className="text-[10px] text-[#7c8db5]">Notify when a service goes offline</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-[#39c5bb]/10" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[#3b4563] text-xs">Performance Warnings</Label>
                  <p className="text-[10px] text-[#7c8db5]">Alert on high CPU/Memory usage</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-[#39c5bb]/10" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[#3b4563] text-xs">AI Insights</Label>
                  <p className="text-[10px] text-[#7c8db5]">Notify on anomaly detections</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-[#39c5bb]/10" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[#3b4563] text-xs">Daily Reports</Label>
                  <p className="text-[10px] text-[#7c8db5]">Receive daily summary reports</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-[#3b4563]">Email Settings</CardTitle>
              <CardDescription className="text-[#7c8db5] text-xs">Configure notification email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-[#3b4563] text-xs">Email Address</Label>
                <Input id="email" type="email" placeholder="admin@nanonet.dev" className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
              </div>
              <Button className="bg-gradient-to-r from-[#39c5bb] to-[#93c5fd] text-white text-xs rounded-xl">Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Settings */}
        <TabsContent value="api" className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-[#3b4563]">API Keys</CardTitle>
              <CardDescription className="text-[#7c8db5] text-xs">Manage your API keys</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="api-key" className="text-[#3b4563] text-xs">API Key</Label>
                <div className="flex gap-2">
                  <Input id="api-key" type="password" defaultValue="nanonet_sk_1234567890" readOnly className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] font-[var(--font-mono)] rounded-xl" />
                  <Button variant="outline" className="border-[#39c5bb]/20 text-[#3b4563] text-xs rounded-xl">Copy</Button>
                </div>
              </div>
              <Button variant="outline" className="border-[#fda4af]/20 text-[#fb7185] hover:bg-[#fda4af]/10 text-xs rounded-xl">Generate New Key</Button>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-[#3b4563]">Webhook</CardTitle>
              <CardDescription className="text-[#7c8db5] text-xs">Configure webhook URL</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="webhook-url" className="text-[#3b4563] text-xs">Webhook URL</Label>
                <Input id="webhook-url" placeholder="https://your-webhook.com/events" className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[#3b4563] text-xs">Webhook Active</Label>
                  <p className="text-[10px] text-[#7c8db5]">Send events to webhook URL</p>
                </div>
                <Switch />
              </div>
              <Button className="bg-gradient-to-r from-[#39c5bb] to-[#93c5fd] text-white text-xs rounded-xl">Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Settings */}
        <TabsContent value="team" className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-[#3b4563]">Team Members</CardTitle>
              <CardDescription className="text-[#7c8db5] text-xs">Manage your team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#f5f8ff] rounded-xl border border-[#39c5bb]/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-[#39c5bb] to-[#93c5fd] rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                      <span className="text-white text-xs font-bold">KV</span>
                    </div>
                    <div>
                      <p className="text-sm text-[#3b4563]">Admin User</p>
                      <p className="text-[10px] text-[#7c8db5]">admin@nanonet.dev</p>
                    </div>
                  </div>
                  <Badge className="bg-[#c4b5fd]/20 text-[#7c3aed] border-[#c4b5fd]/30 text-[10px] rounded-full">ADMIN</Badge>
                </div>
              </div>
              <Button variant="outline" className="w-full border-[#39c5bb]/20 text-[#3b4563] hover:text-[#39c5bb] hover:border-[#39c5bb]/40 text-xs rounded-xl">
                + Add Team Member
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
