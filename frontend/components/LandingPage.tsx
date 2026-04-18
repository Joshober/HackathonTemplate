"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Heart, MapPin, Plane, Camera, Calendar, Star, Image as ImageIcon } from "lucide-react";

function SlideIllustration({ index }: { index: number }) {
  if (index === 1) {
    // Swipe/Vote cards
    return (
      <div className="relative w-full max-w-sm h-72 flex items-center justify-center perspective-1000">
        {/* Back card */}
        <div className="absolute w-48 h-64 bg-white/20 backdrop-blur-md rounded-3xl border border-white/50 shadow-[0_8px_32px_0_rgba(96,165,250,0.2)] transform -rotate-6 -translate-x-6 scale-90 flex flex-col p-4 opacity-70">
          <div className="w-full h-32 bg-blue-300/30 rounded-2xl mb-4" />
          <div className="w-3/4 h-4 bg-blue-300/30 rounded-full mb-2" />
          <div className="w-1/2 h-4 bg-blue-300/30 rounded-full" />
        </div>
        
        {/* Front card (swiping right) */}
        <div className="absolute w-52 h-72 bg-gradient-to-br from-white/40 to-blue-50/20 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_12px_40px_0_rgba(96,165,250,0.4),inset_0_2px_4px_rgba(255,255,255,0.8)] transform rotate-6 translate-x-8 animate-[bounce_4s_infinite] flex flex-col p-4 z-10">
          <div className="w-full h-40 bg-gradient-to-br from-blue-300/40 to-blue-400/20 rounded-2xl mb-4 border border-white/30 relative overflow-hidden flex items-center justify-center">
             {/* Glossy reflection */}
             <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/50 to-transparent pointer-events-none" />
             <MapPin className="w-12 h-12 text-blue-500/80 drop-shadow-md" />
          </div>
          <div className="w-4/5 h-5 bg-blue-400/40 rounded-full mb-2" />
          <div className="w-1/2 h-4 bg-blue-400/20 rounded-full" />
          
          {/* Heart icon badge */}
          <div className="absolute -top-4 -right-4 w-14 h-14 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full flex items-center justify-center border-4 border-white shadow-xl transform rotate-12">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
      </div>
    );
  }

  if (index === 2) {
    // Smart Journey (Itinerary timeline & notifications)
    return (
      <div className="relative w-full max-w-sm h-72 flex items-center justify-center">
        {/* Main Glass Panel */}
        <div className="absolute w-64 h-64 bg-gradient-to-br from-white/40 to-blue-100/20 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-[0_8px_32px_0_rgba(96,165,250,0.3),inset_0_2px_4px_rgba(255,255,255,0.7)] p-5 z-10 flex flex-col justify-between">
          
          {/* Timeline header */}
          <div className="w-full h-8 mb-2 flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-blue-400/30 flex items-center justify-center">
               <Plane className="w-4 h-4 text-blue-600" />
             </div>
             <div className="w-24 h-4 bg-blue-500/40 rounded-full" />
          </div>
          
          {/* Timeline body */}
          <div className="flex-1 relative pl-5 flex flex-col justify-around py-2">
            {/* Glossy timeline line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-1.5 bg-gradient-to-b from-blue-400/50 via-blue-300/30 to-blue-200/10 rounded-full" />
            
            {/* Timeline item 1 */}
            <div className="relative flex items-center gap-3">
              <div className="absolute -left-[20px] w-4 h-4 bg-blue-400 border-[3px] border-white rounded-full shadow-md z-10" />
              <div className="w-full h-8 bg-white/40 rounded-lg border border-white/50" />
            </div>
            
            {/* Timeline item 2 */}
            <div className="relative flex items-center gap-3">
              <div className="absolute -left-[20px] w-4 h-4 bg-white border-[3px] border-blue-200 rounded-full shadow-sm z-10" />
              <div className="w-[80%] h-8 bg-white/20 rounded-lg border border-white/40" />
            </div>
            
            {/* Timeline item 3 */}
            <div className="relative flex items-center gap-3">
              <div className="absolute -left-[20px] w-4 h-4 bg-white border-[3px] border-blue-100 rounded-full shadow-sm z-10" />
              <div className="w-[60%] h-8 bg-white/10 rounded-lg border border-white/20" />
            </div>
          </div>
        </div>
        
        {/* Notification Bubble */}
        <div className="absolute -top-4 -left-4 w-40 h-16 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 shadow-[0_8px_20px_0_rgba(96,165,250,0.2)] flex items-center px-3 gap-3 z-20 animate-[bounce_3s_infinite_0.5s]">
          <div className="w-8 h-8 bg-green-400/20 rounded-full flex items-center justify-center border border-green-400/30">
             <div className="w-4 h-4 text-green-500 rounded-full border-2 border-green-500 flex items-center justify-center text-[10px] font-bold">✓</div>
          </div>
          <div className="flex flex-col gap-1">
             <div className="w-16 h-2 bg-blue-500/50 rounded-full" />
             <div className="w-20 h-2 bg-blue-400/30 rounded-full" />
          </div>
        </div>

        {/* Floating Calendar */}
        <div className="absolute -bottom-6 -right-2 w-20 h-24 bg-gradient-to-br from-white/70 to-blue-50/50 backdrop-blur-md rounded-2xl border border-white/80 shadow-[0_10px_20px_0_rgba(96,165,250,0.2)] flex flex-col z-20 overflow-hidden transform rotate-6">
          <div className="h-6 w-full bg-blue-400/80 flex items-center justify-center">
            <Calendar className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1 flex items-center justify-center">
             <span className="text-2xl font-bold text-blue-500 drop-shadow-sm">14</span>
          </div>
        </div>
      </div>
    );
  }

  if (index === 3) {
    // Memories (Photos overlapping)
    return (
      <div className="relative w-full max-w-sm h-72 flex items-center justify-center perspective-1000">
        
        {/* Back Photo */}
        <div className="absolute w-40 h-48 bg-white/40 backdrop-blur-lg rounded-2xl border border-white/50 shadow-[0_8px_32px_0_rgba(96,165,250,0.2)] p-2.5 transform -rotate-12 -translate-x-12 translate-y-4">
          <div className="w-full h-32 bg-blue-300/30 rounded-xl mb-2 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-blue-400/50" />
          </div>
          <div className="w-1/2 h-3 bg-blue-400/20 rounded-full mx-auto" />
        </div>
        
        {/* Middle Photo */}
        <div className="absolute w-44 h-52 bg-gradient-to-br from-white/50 to-blue-50/30 backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_12px_40px_0_rgba(96,165,250,0.3)] p-3 transform rotate-6 translate-x-12 -translate-y-4 z-10">
          <div className="w-full h-32 bg-blue-300/40 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
            <Camera className="w-10 h-10 text-blue-500/60" />
          </div>
          <div className="w-2/3 h-3.5 bg-blue-400/30 rounded-full mx-auto" />
        </div>
        
        {/* Front Polaroid (Shiny Glass) */}
        <div className="absolute w-48 h-56 bg-gradient-to-br from-white/70 to-white/20 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-[0_16px_48px_0_rgba(96,165,250,0.4),inset_0_2px_4px_rgba(255,255,255,0.9)] p-3.5 transform -rotate-3 translate-y-6 z-20 flex flex-col animate-[bounce_5s_infinite]">
          <div className="flex-1 bg-gradient-to-br from-blue-400/40 to-blue-500/20 rounded-xl mb-3 border border-white/40 flex items-center justify-center relative overflow-hidden">
             {/* Gloss sweep inside photo */}
             <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/40 to-transparent transform skew-x-[30deg] animate-[shimmer_3s_infinite]" />
             <Star className="w-12 h-12 text-white drop-shadow-md fill-white/30" />
          </div>
          <div className="flex justify-between items-center px-1">
            <div className="w-16 h-4 bg-blue-500/40 rounded-full" />
            <div className="flex gap-1 -space-x-3">
              <div className="w-6 h-6 rounded-full bg-blue-200 border-2 border-white shadow-sm" />
              <div className="w-6 h-6 rounded-full bg-pink-200 border-2 border-white shadow-sm z-10" />
              <div className="w-6 h-6 rounded-full bg-purple-200 border-2 border-white shadow-sm z-20" />
            </div>
          </div>
        </div>

        {/* Floating Sparkles */}
        <div className="absolute top-8 left-10 w-4 h-4 rounded-full bg-white/80 blur-[2px] animate-pulse shadow-[0_0_10px_white]" />
        <div className="absolute bottom-12 right-6 w-5 h-5 rounded-full bg-white/70 blur-[2px] animate-[pulse_2s_infinite_1s] shadow-[0_0_15px_white]" />
      </div>
    );
  }

  return null;
}

export function LandingPage() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [titleAnimationComplete, setTitleAnimationComplete] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const slides = [
    {
      title: "Suitcase Squad",
      subtitle: "from plan to return - without the stress spiral",
      description: "A modern mobile web experience for enterprise employees: clear stages, gentle progress, AI woven in - not bolted on the side.",
      showSpline: true,
    },
    {
      title: "Plan Together",
      subtitle: "Discover and decide as a team",
      description: "Swipe through destinations, vote on favorites, and let AI help you find the perfect spots everyone will love.",
      showSpline: false,
    },
    {
      title: "Travel Smart",
      subtitle: "Your journey, guided",
      description: "Real-time updates, smart suggestions, and everything you need in one place. No more juggling apps.",
      showSpline: false,
    },
    {
      title: "Remember Forever",
      subtitle: "Capture the moments that matter",
      description: "Build beautiful memories together with AI-powered photo collections and shared stories.",
      showSpline: false,
    },
  ];

  useEffect(() => {
    // Start title animation immediately
    setTimeout(() => setIsVisible(true), 100);
    // Complete title animation and show rest of content
    setTimeout(() => setTitleAnimationComplete(true), 2000);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      // Swiped left
      if (currentSlide < slides.length - 1) {
        setCurrentSlide(currentSlide + 1);
      }
    }

    if (touchStart - touchEnd < -75) {
      // Swiped right
      if (currentSlide > 0) {
        setCurrentSlide(currentSlide - 1);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setTouchStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (touchStart !== 0) {
      setTouchEnd(e.clientX);
    }
  };

  const handleMouseUp = () => {
    if (touchStart !== 0) {
      if (touchStart - touchEnd > 75) {
        if (currentSlide < slides.length - 1) {
          setCurrentSlide(currentSlide + 1);
        }
      }

      if (touchStart - touchEnd < -75) {
        if (currentSlide > 0) {
          setCurrentSlide(currentSlide - 1);
        }
      }
      setTouchStart(0);
      setTouchEnd(0);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Floating background elements - Static, no interaction */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large floating circles */}
        <div className="absolute top-20 left-10 w-96 h-96 bg-gradient-to-br from-blue-300/50 to-blue-200/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-32 right-20 w-80 h-80 bg-gradient-to-br from-blue-400/40 to-blue-100/30 rounded-full blur-3xl animate-float-slow-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-blue-200/30 to-blue-50/40 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      {/* Slider Container */}
      <div
        ref={containerRef}
        className="relative z-10 h-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide, index) => (
            <div key={index} className="min-w-full h-full flex flex-col max-w-md mx-auto px-6">
              {index === 0 ? (
                <>
                  {/* First slide: Large title at top-center */}
                  <div className="pt-12 text-center">
                    <div className="relative inline-block">
                      <h1
                        className={`font-black tracking-tight transition-all duration-1000 ease-out relative leading-tight ${ isVisible ? titleAnimationComplete ? "text-7xl opacity-100 rotate-0 scale-100" : "text-8xl opacity-100 rotate-[360deg] scale-110" : "text-8xl opacity-0 rotate-0 scale-150" } px-[0px] py-[35px]`}
                        style={{
                          transform: titleAnimationComplete
                            ? "translate(0, 0)"
                            : isVisible
                            ? "translate(0, calc(50vh - 50%))"
                            : "translate(0, calc(50vh - 50%))",
                          transition: "all 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                          color: "#ffffff",
                          textShadow: `
                            0 1px 0 #f0f0f0,
                            0 2px 0 #e8e8e8,
                            0 3px 0 #e0e0e0,
                            0 4px 0 #d8d8d8,
                            0 5px 0 #d0d0d0,
                            0 6px 0 #c8c8c8,
                            0 7px 0 #c0c0c0,
                            0 8px 0 #b8b8b8,
                            0 0 20px rgba(59, 130, 246, 0.6),
                            0 0 40px rgba(59, 130, 246, 0.4),
                            0 0 60px rgba(59, 130, 246, 0.2),
                            0 10px 30px rgba(0, 0, 0, 0.15)
                          `,
                        }}
                      >
                        SUITCASE<br/>SQUAD
                      </h1>
                    </div>
                  </div>

                  {/* Description - left aligned, close to title */}
                  <div className="mt-4 px-4">
                    <p
                      className={`text-base text-gray-600 leading-relaxed transition-all duration-1000 delay-500 ${
                        titleAnimationComplete ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                      }`}
                    >
                      From plan to return - without the stress spiral
                    </p>
                    <p
                      className={`text-xs text-gray-500 leading-relaxed mt-2 transition-all duration-1000 delay-600 ${
                        titleAnimationComplete ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                      }`}
                    >
                      A modern mobile web experience for enterprise employees: clear stages, gentle progress, AI woven in - not bolted on the side.
                    </p>
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Spline animation at bottom */}
                  <div
                    className={`transform transition-all duration-1000 delay-700 ${
                      titleAnimationComplete ? "scale-100 opacity-100" : "scale-95 opacity-0"
                    }`}
                  >
                    <div className="w-full h-[600px]">
                      <iframe
                        src="https://my.spline.design/r4xbot-ZAO47bBWPaUfGjrZxIcCxEnz/"
                        className="w-full h-full border-0 mx-[0px] my-[-223px]"
                        title="3D Animation"
                      />
                    </div>
                  </div>

                  {/* Login Button */}
                  <div
                    className={`pb-12 px-4 transform transition-all duration-1000 delay-900 ${
                      titleAnimationComplete ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                    }`}
                  >
                    <button
                      onClick={() => router.push("/home")}
                      onMouseEnter={() => setIsButtonHovered(true)}
                      onMouseLeave={() => setIsButtonHovered(false)}
                      className="relative w-full py-4 rounded-full font-bold text-lg overflow-hidden transition-all duration-500 backdrop-blur-md bg-blue-400/30 border border-white/50 shadow-[0_8px_32px_0_rgba(96,165,250,0.3),inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-3px_6px_rgba(96,165,250,0.4)] hover:bg-blue-400/40 hover:shadow-[0_12px_36px_0_rgba(96,165,250,0.4),inset_0_4px_8px_rgba(255,255,255,0.8),inset_0_-3px_6px_rgba(96,165,250,0.5)] active:scale-[0.98] text-white group"
                    >
                      {/* Glossy top reflection highlight */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-4 bg-gradient-to-b from-white/70 to-transparent rounded-b-full opacity-70 pointer-events-none" />
                      
                      {/* Sweeping shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none" />
                      
                      {/* Text */}
                      <span className="relative z-10 drop-shadow-[0_1px_3px_rgba(30,58,138,0.5)]">Login</span>
                      
                      {/* Ripple/Pulse animation on hover */}
                      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                        {isButtonHovered && (
                          <div className="absolute inset-0 animate-ripple flex items-center justify-center">
                            <div className="w-full h-full rounded-full border-[3px] border-white/60 scale-0 animate-ping" />
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Other slides: Normal layout */}
                  <div className="pt-16 pb-8 text-center">
                    <h1 className="font-black text-gray-900 mb-3 tracking-tight text-5xl">
                      {slide.title}
                    </h1>
                    <p className="text-lg text-gray-600">
                      {slide.subtitle}
                    </p>
                    <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                      {slide.description}
                    </p>
                  </div>

                  {/* Middle: Illustration */}
                  <div className="flex-1 flex items-center justify-center w-full my-4">
                    <SlideIllustration index={index} />
                  </div>

                  {/* Bottom: CTA Button (only on last slide) */}
                  {index === slides.length - 1 && (
                    <div className="pb-12 px-4">
                      <button
                        onClick={() => router.push("/home")}
                        onMouseEnter={() => setIsButtonHovered(true)}
                        onMouseLeave={() => setIsButtonHovered(false)}
                        className="relative w-full py-4 rounded-full font-bold text-lg overflow-hidden transition-all duration-500 backdrop-blur-md bg-blue-400/30 border border-white/50 shadow-[0_8px_32px_0_rgba(96,165,250,0.3),inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-3px_6px_rgba(96,165,250,0.4)] hover:bg-blue-400/40 hover:shadow-[0_12px_36px_0_rgba(96,165,250,0.4),inset_0_4px_8px_rgba(255,255,255,0.8),inset_0_-3px_6px_rgba(96,165,250,0.5)] active:scale-[0.98] text-white group"
                      >
                        {/* Glossy top reflection highlight */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-4 bg-gradient-to-b from-white/70 to-transparent rounded-b-full opacity-70 pointer-events-none" />
                        
                        {/* Sweeping shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none" />
                        
                        {/* Text */}
                        <span className="relative z-10 drop-shadow-[0_1px_3px_rgba(30,58,138,0.5)]">Start Your Journey</span>
                        
                        {/* Ripple/Pulse animation on hover */}
                        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                          {isButtonHovered && (
                            <div className="absolute inset-0 animate-ripple flex items-center justify-center">
                              <div className="w-full h-full rounded-full border-[3px] border-white/60 scale-0 animate-ping" />
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Empty space for pagination dots on other slides */}
                  {index !== slides.length - 1 && <div className="pb-12" />}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination Dots */}
      <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`transition-all duration-300 rounded-full ${
              index === currentSlide
                ? "w-8 h-2 bg-gray-900"
                : "w-2 h-2 bg-gray-400 hover:bg-gray-600"
            }`}
          />
        ))}
      </div>

      <style>{`
        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        .animate-ripple {
          animation: ripple 1s ease-out infinite;
        }

        @keyframes float-slow {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(30px, -30px) scale(1.1);
          }
        }
        .animate-float-slow {
          animation: float-slow 35s ease-in-out infinite;
        }

        @keyframes float-slow-reverse {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-40px, 40px) scale(1.15);
          }
        }
        .animate-float-slow-reverse {
          animation: float-slow-reverse 40s ease-in-out infinite;
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.05);
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 15s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(30deg); }
          100% { transform: translateX(150%) skewX(30deg); }
        }
      `}</style>
    </div>
  );
}
