"use client";

import { RoleRedirect } from "@/components/RoleRedirect";
import { profilePath } from "@/lib/routes";

export default function LegacySettingsRedirect() {
  return <RoleRedirect to={profilePath} />;
}
