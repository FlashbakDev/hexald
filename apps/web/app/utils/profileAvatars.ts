import type { ProfileAvatarId } from "@hexald/shared";
import { isProfileAvatarId, PROFILE_AVATAR_IDS } from "@hexald/shared";

import imgAlexander from "~/assets/images/generated/profile-alexander.png";
import imgCaesar from "~/assets/images/generated/profile-caesar.png";
import imgCharlemagne from "~/assets/images/generated/profile-charlemagne.png";
import imgCleopatra from "~/assets/images/generated/profile-cleopatra.png";
import imgConfucius from "~/assets/images/generated/profile-confucius.png";
import imgCurie from "~/assets/images/generated/profile-curie.png";
import imgEinstein from "~/assets/images/generated/profile-einstein.png";
import imgGenghis from "~/assets/images/generated/profile-genghis.png";
import imgHatshepsut from "~/assets/images/generated/profile-hatshepsut.png";
import imgJoanOfArc from "~/assets/images/generated/profile-jeanne-darc.png";
import imgLeonardo from "~/assets/images/generated/profile-leonardo-da-vinci.png";
import imgMozart from "~/assets/images/generated/profile-mozart.png";
import imgNapoleon from "~/assets/images/generated/profile-napoleon.png";
import imgNefertiti from "~/assets/images/generated/profile-nefertiti.png";
import imgSocrates from "~/assets/images/generated/profile-socrates.png";

const PROFILE_AVATAR_SRC: Record<ProfileAvatarId, string> = {
  Napoleon: imgNapoleon,
  Caesar: imgCaesar,
  Alexander: imgAlexander,
  Einstein: imgEinstein,
  Curie: imgCurie,
  Mozart: imgMozart,
  Confucius: imgConfucius,
  Nefertiti: imgNefertiti,
  Genghis: imgGenghis,
  Charlemagne: imgCharlemagne,
  Cleopatra: imgCleopatra,
  Leonardo: imgLeonardo,
  JoanOfArc: imgJoanOfArc,
  Socrates: imgSocrates,
  Hatshepsut: imgHatshepsut
};

/** Libellés FR pour le picker. */
const PROFILE_AVATAR_LABELS: Record<ProfileAvatarId, string> = {
  Napoleon: "Napoléon",
  Caesar: "César",
  Alexander: "Alexandre",
  Einstein: "Einstein",
  Curie: "Marie Curie",
  Mozart: "Mozart",
  Confucius: "Confucius",
  Nefertiti: "Néfertiti",
  Genghis: "Gengis Khan",
  Charlemagne: "Charlemagne",
  Cleopatra: "Cléopâtre",
  Leonardo: "Léonard",
  JoanOfArc: "Jeanne d’Arc",
  Socrates: "Socrate",
  Hatshepsut: "Hatchepsout"
};

const PROFILE_AVATAR_FILES: Record<ProfileAvatarId, string> = {
  Napoleon: "profile-napoleon.png",
  Caesar: "profile-caesar.png",
  Alexander: "profile-alexander.png",
  Einstein: "profile-einstein.png",
  Curie: "profile-curie.png",
  Mozart: "profile-mozart.png",
  Confucius: "profile-confucius.png",
  Nefertiti: "profile-nefertiti.png",
  Genghis: "profile-genghis.png",
  Charlemagne: "profile-charlemagne.png",
  Cleopatra: "profile-cleopatra.png",
  Leonardo: "profile-leonardo-da-vinci.png",
  JoanOfArc: "profile-jeanne-darc.png",
  Socrates: "profile-socrates.png",
  Hatshepsut: "profile-hatshepsut.png"
};

export type ProfileAvatarOption = {
  id: ProfileAvatarId;
  label: string;
  src: string;
  file: string;
};

export const PROFILE_AVATAR_OPTIONS: ProfileAvatarOption[] = PROFILE_AVATAR_IDS.map(
  (id) => ({
    id,
    label: PROFILE_AVATAR_LABELS[id],
    src: PROFILE_AVATAR_SRC[id],
    file: PROFILE_AVATAR_FILES[id]
  })
);

export function profileAvatarSrc(
  avatarId: string | null | undefined
): string | null {
  if (!isProfileAvatarId(avatarId)) return null;
  return PROFILE_AVATAR_SRC[avatarId] ?? null;
}
