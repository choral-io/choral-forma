import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { useTheme, type ThemeMode } from "@/app/theme-context";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const themeOptions: {
    icon: typeof SunIcon;
    label: string;
    mode: ThemeMode;
}[] = [
    { icon: SunIcon, label: "Light", mode: "light" },
    { icon: MoonIcon, label: "Dark", mode: "dark" },
    { icon: MonitorIcon, label: "System", mode: "system" },
];

export function ThemeModeMenu() {
    const { mode, resolvedMode, setMode } = useTheme();
    const TriggerIcon = resolvedMode === "dark" ? MoonIcon : SunIcon;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button aria-label="Change theme" size="icon" variant="outline" />}>
                <TriggerIcon data-icon="inline-start" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Theme</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {themeOptions.map((option) => (
                        <DropdownMenuItem
                            key={option.mode}
                            onClick={() => {
                                setMode(option.mode);
                            }}
                        >
                            <option.icon data-icon="inline-start" />
                            <span className="flex-1">{option.label}</span>
                            <CheckIcon
                                aria-hidden
                                className={cn("ms-auto", mode === option.mode ? "opacity-100" : "opacity-0")}
                            />
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
