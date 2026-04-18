import { Outlet, useLocation, useNavigate } from "react-router";
import { Home, Compass, MessageSquare, Users, User, Check, LayoutGrid } from "lucide-react";
import { usePlanning } from "../context/PlanningContext";

const stages = [
  { name: "Plan", color: "bg-blue-500", glowColor: "shadow-blue-500/50", gradient: "from-blue-500 to-blue-600", paths: ["/", "/explorer"] },
  { name: "Approve", color: "bg-purple-500", glowColor: "shadow-purple-500/50", gradient: "from-purple-500 to-purple-600", paths: ["/approval", "/booking"] },
  { name: "Travel", color: "bg-green-500", glowColor: "shadow-green-500/50", gradient: "from-green-500 to-green-600", paths: ["/travel", "/calendar"] },
  { name: "Return", color: "bg-orange-500", glowColor: "shadow-orange-500/50", gradient: "from-orange-500 to-orange-600", paths: ["/return", "/memory"] },
];

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPlanningActive, isLeader } = usePlanning();

  const currentStageIndex = stages.findIndex((stage) =>
    stage.paths.some((path) => location.pathname === path)
  );

  const currentStage = stages[currentStageIndex] || stages[0];

  const tabs = [
    { name: "Home", icon: Home, path: "/" },
    { name: "Explorer", icon: Compass, path: "/explorer" },
    { name: "AI", icon: MessageSquare, path: "/assistant" },
    { name: "Team", icon: Users, path: "/team" },
    { name: "More", icon: LayoutGrid, path: "/profile" },
  ];

  // Filter stages based on user role when planning is active
  const visibleStages = isPlanningActive && !isLeader
    ? stages.filter(s => s.name === "Travel" || s.name === "Return")
    : stages;

  return (
    <div className="h-screen flex flex-col bg-gray-50 relative">
      {/* Stage Progress Indicator - Only show when planning is active */}
      {isPlanningActive && (
        <div className="relative glass-panel border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between max-w-md mx-auto">
              {/* Left: Stage Progress */}
              <div className="flex items-center gap-3">
                {visibleStages.map((stage, index) => {
                  const isCompleted = index < currentStageIndex;
                  const isActive = index === currentStageIndex;

                  return (
                    <div key={stage.name} className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {/* Stage Name */}
                        <span
                          className={`text-sm font-semibold transition-all duration-300 ${
                            isActive
                              ? "text-gray-900"
                              : isCompleted
                              ? "text-gray-600"
                              : "text-gray-400"
                          }`}
                        >
                          {stage.name}
                        </span>
                      </div>
                      {/* Arrow separator (except for last item) */}
                      {index < visibleStages.length - 1 && (
                        <span className="text-gray-400 text-xs">→</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right: Profile Avatar */}
              <div className="w-10 h-10 rounded-full glass-button flex items-center justify-center text-gray-900 font-bold text-sm shine-overlay">
                V
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto relative bg-gray-50">
        <Outlet />
      </div>

      {/* Bottom Navigation - Premium Glass Design */}
      <div className="bg-gray-50 safe-area-inset-bottom pb-6 px-6">
        <div className="max-w-md mx-auto">
          <div className="glass-panel rounded-[28px] p-1.5 flex items-center justify-around shadow-2xl shine-overlay">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className="relative flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-300"
                >
                  {/* Active Background */}
                  {isActive && (
                    <div className="absolute inset-0 glass-button rounded-[20px] mx-1" />
                  )}
                  
                  {/* Icon */}
                  <div className="relative z-10">
                    <Icon 
                      className={`w-6 h-6 transition-colors ${
                        isActive ? "text-gray-900" : "text-gray-500"
                      }`}
                      strokeWidth={2}
                      fill="none"
                    />
                  </div>
                  
                  {/* Label */}
                  <span className={`relative z-10 text-[10px] font-medium transition-colors ${
                    isActive ? "text-gray-900" : "text-gray-500"
                  }`}>
                    {tab.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}