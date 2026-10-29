import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogIn, Phone, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { resolvePortalAssetUrl } from "@/utils/resolvePortalAssetUrl";
import { usePortalContent } from "@/hooks/usePortalContent";
import EmergencyPopup from "@/components/common/EmergencyPopup";

type NavLink = { label: string; href: string; disabled?: boolean };

const defaultNavLinks: NavLink[] = [
    { label: "Home", href: "/" },
    { label: "About", href: "/#about" },
    { label: "Services", href: "/portal/services" },
    { label: "News", href: "/news" },
    { label: "Flood", href: "/flood-dashboard" },
    { label: "Feedback", href: "/feedback" },
    { label: "Contact Us", href: "/#contact" },
];

const Header: React.FC<{
    branding?: { portalName?: string; logoUrl?: string };
    header?: { navLinks?: NavLink[]; ctaLabel?: string; ctaHref?: string };
    variant?: "dark" | "light";
    solidBackground?: boolean;
}> = ({ branding, header, variant = "dark", solidBackground = false }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showPopover, setShowPopover] = useState(false);
    const [showFullModal, setShowFullModal] = useState(false);
    const popoverTimerRef = useRef<NodeJS.Timeout | null>(null);

    const { portalContent } = usePortalContent();

    const isLightMode = variant === "light" || solidBackground || isScrolled;

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = useMemo(() => {
        let rawLinks: NavLink[] = defaultNavLinks;
        if (Array.isArray(header?.navLinks) && header.navLinks.length > 0) {
            rawLinks = header.navLinks.filter((link) => link?.disabled !== true);
        }

        let linksList = [...rawLinks];

        const hasNews = linksList.some(
            (link) => link.href === "/news" || link.label.toLowerCase() === "news"
        );

        if (!hasNews) {
            const feedbackIndex = linksList.findIndex(
                (link) => link.href === "/feedback" || link.label.toLowerCase() === "feedback"
            );
            const newsLink: NavLink = { label: "News", href: "/news" };

            if (feedbackIndex !== -1) {
                linksList.splice(feedbackIndex + 1, 0, newsLink);
            } else {
                linksList.push(newsLink);
            }
        }

        const hasFlood = linksList.some(
            (link) => link.label.toLowerCase() === "flood" || link.href.includes("category=Flood") || link.href.includes("category=Emergency")
        );

        if (!hasFlood) {
            const newsIndex = linksList.findIndex(
                (link) => link.href === "/news" || link.label.toLowerCase() === "news"
            );
            const floodLink: NavLink = { label: "Flood", href: "/flood-dashboard" };

            if (newsIndex !== -1) {
                linksList.splice(newsIndex + 1, 0, floodLink);
            } else {
                linksList.push(floodLink);
            }
        }

        return linksList;
    }, [header?.navLinks]);

    const ctaLabel = header?.ctaLabel || "My Portal";
    const ctaHref = header?.ctaHref || "/login";
    const portalName = branding?.portalName || "PDRM";
    const logoUrl = resolvePortalAssetUrl(branding?.logoUrl) || "/images/logo/logo.png";

    // Emergency hotline details from site-settings
    const emergencyConfig = portalContent?.pages?.emergencyPopup;
    const isEmergencyEnabled = emergencyConfig?.enabled !== false;
    const phoneNumber = emergencyConfig?.contact?.phoneNumber || "939";
    const contactTitle = emergencyConfig?.contact?.title || emergencyConfig?.title || "Emergency Response";
    const availabilityText = emergencyConfig?.contact?.availabilityText || "24/7 Response Line";
    const emergencyMessage = emergencyConfig?.message || emergencyConfig?.contact?.description || "";
    const alternatePhone = emergencyConfig?.contact?.alternatePhoneNumber;

    const handleMouseEnter = () => {
        if (popoverTimerRef.current) clearTimeout(popoverTimerRef.current);
        setShowPopover(true);
    };

    const handleMouseLeave = () => {
        popoverTimerRef.current = setTimeout(() => {
            setShowPopover(false);
        }, 180);
    };

    return (
        <>
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                    isLightMode
                        ? "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md border-b border-slate-200/80 dark:border-slate-800 py-3.5"
                        : "bg-transparent py-5"
                }`}
            >
                {/* Embedded CSS for blink and glowing pulse animations */}
                <style>{`
                    @keyframes headerNumberBlink {
                        0%, 100% {
                            opacity: 1;
                            transform: scale(1);
                        }
                        50% {
                            opacity: 0.25;
                            transform: scale(0.96);
                        }
                    }
                    @keyframes headerBadgeGlow {
                        0%, 100% {
                            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7);
                        }
                        50% {
                            box-shadow: 0 0 0 8px rgba(220, 38, 38, 0);
                        }
                    }
                `}</style>

                <div className="container mx-auto px-4 md:px-6">
                    <nav className="flex items-center justify-between">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-3 group">
                            <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shadow-sm border border-slate-200 dark:border-slate-700">
                                <img
                                    src={logoUrl}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = "/images/logo/logo.png";
                                    }}
                                    alt="PDRM Logo"
                                    className="w-8 h-8 object-contain"
                                />
                            </div>
                            <span className={`text-2xl font-black tracking-tight ${
                                isLightMode ? "text-slate-900 dark:text-white" : "text-slate-900 dark:text-white md:text-white"
                            }`}>
                                {portalName}
                            </span>
                        </Link>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center gap-6">
                            {navLinks.map((link) => {
                                const isInternalSpaRoute = link.href.startsWith("/") && !link.href.includes("#");
                                const linkClasses = `text-sm font-bold relative group transition-colors ${
                                    isLightMode ? "text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400" : "text-white/90 hover:text-accent-200"
                                }`;

                                return isInternalSpaRoute ? (
                                    <Link
                                        key={link.label}
                                        to={link.href}
                                        className={linkClasses}
                                    >
                                        {link.label}
                                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 group-hover:w-full"></span>
                                    </Link>
                                ) : (
                                    <a
                                        key={link.label}
                                        href={link.href}
                                        className={linkClasses}
                                    >
                                        {link.label}
                                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 group-hover:w-full"></span>
                                    </a>
                                );
                            })}

                            <Link
                                to={ctaHref}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-full transition-all duration-300 transform hover:scale-105 shadow-md flex items-center gap-2"
                            >
                                {ctaLabel}
                                <LogIn className="w-4 h-4" />
                            </Link>

                            {/* Right end: Emergency number with blink format and hover popover */}
                            {isEmergencyEnabled && (
                                <div
                                    className="relative pl-1"
                                    onMouseEnter={handleMouseEnter}
                                    onMouseLeave={handleMouseLeave}
                                >
                                    {/* Number pill with blinking format */}
                                    <a
                                        href={`tel:${phoneNumber}`}
                                        aria-label={`Emergency Call Number ${phoneNumber}`}
                                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md hover:from-red-500 hover:to-red-600 transition-all duration-200 border border-red-400/50 cursor-pointer select-none"
                                        style={{ animation: "headerBadgeGlow 2s infinite" }}
                                    >
                                        {/* Blinking ping beacon */}
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                        </span>
                                        <Phone className="w-3.5 h-3.5 text-white/95" />
                                        {/* Number displayed with blink format */}
                                        <span
                                            style={{ animation: "headerNumberBlink 1.4s ease-in-out infinite" }}
                                            className="font-black text-sm tracking-wider text-white"
                                        >
                                            {phoneNumber}
                                        </span>
                                    </a>

                                    {/* Hover Popover */}
                                    <AnimatePresence>
                                        {showPopover && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                                transition={{ duration: 0.16 }}
                                                className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/60 overflow-hidden z-50 text-left"
                                                onMouseEnter={handleMouseEnter}
                                                onMouseLeave={handleMouseLeave}
                                            >
                                                {/* Header banner */}
                                                <div className="bg-gradient-to-r from-red-600 to-red-700 p-4 text-white">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-white">
                                                            🚨 Emergency Hotline
                                                        </span>
                                                        <span className="text-[11px] font-medium opacity-90">
                                                            {availabilityText}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-black text-lg mt-1 text-white leading-tight">
                                                        {contactTitle}
                                                    </h4>
                                                </div>

                                                {/* Popover body */}
                                                <div className="p-4 space-y-3">
                                                    {emergencyMessage && (
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                            {emergencyMessage}
                                                        </p>
                                                    )}

                                                    {/* Call Option Button */}
                                                    <a
                                                        href={`tel:${phoneNumber}`}
                                                        className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-sm shadow-md shadow-red-500/25 transition-transform hover:scale-[1.02]"
                                                    >
                                                        <Phone className="w-4 h-4 animate-bounce" />
                                                        <span>Call {phoneNumber}</span>
                                                    </a>

                                                    {/* Alternate number if available */}
                                                    {alternatePhone && (
                                                        <a
                                                            href={`tel:${alternatePhone}`}
                                                            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold text-xs border border-red-200 dark:border-red-900/40 hover:bg-red-100 transition"
                                                        >
                                                            <span>Alternate: {alternatePhone}</span>
                                                        </a>
                                                    )}

                                                    {/* Footer actions */}
                                                    <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setShowPopover(false);
                                                                setShowFullModal(true);
                                                            }}
                                                            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold text-[11px] underline"
                                                        >
                                                            Full Notice
                                                        </button>
                                                        <Link
                                                            to="/emergency-contacts"
                                                            onClick={() => setShowPopover(false)}
                                                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1 text-[11px]"
                                                        >
                                                            <span>All Contacts</span>
                                                            <ExternalLink className="w-3 h-3" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        {/* Mobile right section: blinking number + mobile menu hamburger */}
                        <div className="flex md:hidden items-center gap-2">
                            {isEmergencyEnabled && (
                                <a
                                    href={`tel:${phoneNumber}`}
                                    aria-label={`Call Emergency ${phoneNumber}`}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-black shadow-sm"
                                    style={{ animation: "headerBadgeGlow 2s infinite" }}
                                >
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                    </span>
                                    <Phone className="w-3 h-3" />
                                    <span style={{ animation: "headerNumberBlink 1.4s ease-in-out infinite" }}>
                                        {phoneNumber}
                                    </span>
                                </a>
                            )}

                            {/* Mobile menu button */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className={`p-2 rounded-lg transition-colors ${
                                    isLightMode ? "text-slate-900 dark:text-white" : "text-white"
                                }`}
                            >
                                {isMobileMenuOpen ? <X /> : <Menu />}
                            </button>
                        </div>
                    </nav>
                </div>

                {/* Mobile Menu Overlay */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden bg-white dark:bg-slate-800 border-t dark:border-slate-700 overflow-hidden"
                        >
                            <div className="flex flex-col p-4 gap-4">
                                {isEmergencyEnabled && (
                                    <a
                                        href={`tel:${phoneNumber}`}
                                        className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-sm shadow-md"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 animate-bounce" />
                                            <span>Emergency: {contactTitle}</span>
                                        </div>
                                        <span
                                            style={{ animation: "headerNumberBlink 1.4s ease-in-out infinite" }}
                                            className="text-base font-black tracking-wider bg-white/20 px-2.5 py-0.5 rounded-lg"
                                        >
                                            {phoneNumber}
                                        </span>
                                    </a>
                                )}

                                {navLinks.map((link) => {
                                    const isInternalSpaRoute = link.href.startsWith("/") && !link.href.includes("#");
                                    const mobileClasses = "text-slate-600 dark:text-slate-300 font-medium py-2 px-4 hover:text-brand-600 hover:bg-brand-50/70 dark:hover:text-accent-300 dark:hover:bg-brand-500/15 rounded-lg transition-colors";

                                    return isInternalSpaRoute ? (
                                        <Link
                                            key={link.label}
                                            to={link.href}
                                            className={mobileClasses}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            {link.label}
                                        </Link>
                                    ) : (
                                        <a
                                            key={link.label}
                                            href={link.href}
                                            className={mobileClasses}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            {link.label}
                                        </a>
                                    );
                                })}
                                <Link
                                    to={ctaHref}
                                    className="mx-4 mt-2 px-6 py-3 bg-gradient-to-r from-accent-600 via-accent-600 to-accent-500 text-white text-center font-semibold rounded-lg shadow-md flex items-center justify-center gap-2"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {ctaLabel}
                                    <LogIn className="w-4 h-4" />
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* Optional full modal preview triggered from header popover */}
            {showFullModal && (
                <EmergencyPopup
                    forceOpen={true}
                    onClosePreview={() => setShowFullModal(false)}
                    config={emergencyConfig}
                />
            )}
        </>
    );
};

export default Header;
