import { User, Settings, Bell, CreditCard, Shield, LogOut, ChevronRight } from "lucide-react";
import { PageHeader } from "../common/PageHeader";

export function Profile() {
  const menuItems = [
    { icon: User, label: "Personal Information", description: "Update your profile" },
    { icon: Settings, label: "Travel Preferences", description: "Seat, meal, hotel preferences" },
    { icon: Bell, label: "Notifications", description: "Manage alerts and updates" },
    { icon: CreditCard, label: "Payment Methods", description: "Credit cards and billing" },
    { icon: Shield, label: "Privacy & Security", description: "Data and account security" },
  ];

  return (
    <div className="max-w-md mx-auto pb-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <PageHeader subtitle="Manage your account and preferences" />

      <div className="p-4">
        {/* User Card */}
        <div className="glass-gradient-button rounded-2xl p-6 text-white mb-6 shine-overlay">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
              V
            </div>
            <div>
              <h2 className="text-xl font-bold">Victoria Chen</h2>
              <p className="text-white/80 text-sm">victoria.chen@company.com</p>
            </div>
          </div>
          <div className="flex gap-4 pt-4 border-t border-white/20">
            <div>
              <div className="text-2xl font-bold">12</div>
              <div className="text-white/80 text-xs">Trips</div>
            </div>
            <div>
              <div className="text-2xl font-bold">8</div>
              <div className="text-white/80 text-xs">Countries</div>
            </div>
            <div>
              <div className="text-2xl font-bold">Leader</div>
              <div className="text-white/80 text-xs">Role</div>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-2 mb-6">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                className="w-full glass-card rounded-xl p-4 flex items-center gap-4 hover:glass-button transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full glass-button flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gray-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.label}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            );
          })}
        </div>

        {/* Sign Out */}
        <button className="w-full glass-button rounded-xl p-4 font-semibold flex items-center justify-center gap-2 hover:bg-red-500/10 transition-all border-2 border-red-500/30 text-red-500">
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>

        {/* Version */}
        <div className="text-center mt-6 text-sm text-gray-500">
          Suitcase Squad v1.0.0
        </div>
      </div>
    </div>
  );
}