import { Check, Moon, Sun, SunMoon } from "lucide-react";

import { getNextThemePreference, type ThemePreference } from "@/lib/theme-preference";
import { cn } from "@/lib/utils";

const themePopoverId = "workspace-theme-menu";
const themePopoverAnchor = "--workspace-theme-menu";

const options = [
    { icon: SunMoon, label: "System", value: "system" },
    { icon: Sun, label: "Light", value: "choral-light" },
    { icon: Moon, label: "Dark", value: "choral-dark" },
] as const satisfies readonly {
    icon: typeof SunMoon;
    label: string;
    value: ThemePreference;
}[];

interface ThemeControlProps {
    onPreferenceChange: (preference: ThemePreference) => void;
    preference: ThemePreference;
}

export function ThemeDropdown({
    className,
    onPreferenceChange,
    preference,
}: ThemeControlProps & { className?: string }) {
    const currentOption = options.find((option) => option.value === preference) ?? options[0];
    const CurrentIcon = currentOption.icon;
    return (
        <>
            <button
                aria-label={`Theme: ${currentOption.label}`}
                className={cn("btn btn-square btn-ghost", className)}
                popoverTarget={themePopoverId}
                style={{ anchorName: themePopoverAnchor }}
                title={`Theme: ${currentOption.label}`}
                type="button"
            >
                <CurrentIcon aria-hidden="true" />
            </button>
            <ul
                aria-label="Theme"
                className="dropdown dropdown-end menu bg-base-200 rounded-box mt-2 w-44 p-2 shadow-lg"
                id={themePopoverId}
                popover="auto"
                style={{ positionAnchor: themePopoverAnchor }}
            >
                {options.map(({ icon: Icon, label, value }) => (
                    <li key={value}>
                        <label>
                            <input
                                className="peer sr-only"
                                checked={preference === value}
                                name="workspace-theme"
                                onChange={(event) => {
                                    if (!event.currentTarget.checked) return;
                                    onPreferenceChange(value);
                                    document.getElementById(themePopoverId)?.hidePopover();
                                }}
                                type="radio"
                                value={value}
                            />
                            <Icon aria-hidden="true" className="size-4" />
                            <span className="grow">{label}</span>
                            <Check aria-hidden="true" className="hidden size-4 peer-checked:block" />
                        </label>
                    </li>
                ))}
            </ul>
        </>
    );
}

export function ThemeCycleButton({ onPreferenceChange, preference }: ThemeControlProps) {
    const currentOption = options.find((option) => option.value === preference) ?? options[0];
    const nextPreference = getNextThemePreference(preference);
    const nextOption = options.find((option) => option.value === nextPreference) ?? options[0];
    const Icon = currentOption.icon;

    return (
        <button
            aria-label={`Theme: ${currentOption.label}. Switch to ${nextOption.label}`}
            className="btn btn-circle btn-lg btn-neutral"
            onClick={() => {
                onPreferenceChange(nextPreference);
            }}
            type="button"
        >
            <Icon aria-hidden="true" className="size-5" />
        </button>
    );
}
