import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import TopMenuBar from "./TopMenuBar";
import ScreenShareConsent from "./ScreenShareConsent";
import ImpersonationBanner from "./ImpersonationBanner";
import SyncStatus from "./SyncStatus";
import DirtyStateBadge from "./DirtyStateBadge";
import { useGroupRealtimeSync } from "@/hooks/use-group-realtime-sync";
import bgLandscape from "@/assets/bg-sawah-sunset.jpg";

function getTahun() {
  try {
    return JSON.parse(localStorage.getItem('siskeudes_desa_profile') || '{}').tahunAnggaran || new Date().getFullYear();
  } catch { return new Date().getFullYear(); }
}

export default function AppLayout() {
  useGroupRealtimeSync();
  const location = useLocation();
  const [transitioning, setTransitioning] = useState(false);
  const [displayLocation, setDisplayLocation] = useState(location);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setTransitioning(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [location, displayLocation]);

  return (
    <div className="flex flex-col h-screen overflow-hidden relative">
      {/* Full-screen background image covering everything */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgLandscape})` }} />
      
      {/* Admin impersonation banner */}
      <ImpersonationBanner />

      {/* Top Menu Bar */}
      <TopMenuBar />

      {/* Main content area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Subtle dark overlay for readability on non-home pages */}
        {location.pathname !== "/" &&
        <div className="absolute inset-0 z-0 bg-sidebar/30 backdrop-blur-[1px]" />
        }

        {/* Content with morph transition */}
        <main
          className={`relative z-10 h-full overflow-y-auto transition-all duration-300 ease-out ${
          transitioning ?
          "opacity-0 scale-[0.97] translate-y-2 blur-sm" :
          "opacity-100 scale-100 translate-y-0 blur-0"}`
          }>
          
          <Outlet />
          <ScreenShareConsent />
          <SyncStatus />
        </main>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-sidebar-border text-[10px] px-[17px] py-[7px] rounded-sm flex-row border-0 border-none flex items-center justify-between bg-sidebar/90 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
        <span className="text-sidebar-foreground/80">© 2024 Sistem Pengelolaan Keuangan Desa for Education</span>
        <DirtyStateBadge />
        <span className="text-sidebar-foreground/80">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        <span className="text-sidebar-foreground/80 font-medium">Tahun Anggaran {getTahun()}</span>
      </div>
    </div>);

}