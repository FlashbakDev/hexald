<script setup lang="ts">
import {
  NOTIFICATION_OPTIONS,
  useNotificationPreferences
} from "~/composables/useNotificationPreferences";

const open = defineModel<boolean>("open", { default: false });

const { prefs, enabledCount, setEnabled } = useNotificationPreferences();

function close() {
  open.value = false;
}

function onBackdropKey(event: KeyboardEvent) {
  if (event.key === "Escape") close();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="play-notif-settings">
      <div
        v-if="open"
        class="play-notif-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-settings-title"
        @keydown="onBackdropKey"
      >
        <button
          type="button"
          class="play-notif-settings__backdrop"
          aria-label="Fermer"
          @click="close"
        />

        <aside class="play-notif-settings__panel">
          <div class="play-notif-settings__handle" aria-hidden="true" />

          <header class="play-notif-settings__header">
            <div>
              <p class="play-notif-settings__eyebrow">Réglages</p>
              <h2 id="notif-settings-title" class="play-notif-settings__title">
                Notifications
              </h2>
            </div>
            <button
              type="button"
              class="play-notif-settings__close"
              aria-label="Fermer"
              @click="close"
            >
              <UIcon name="i-lucide-x" class="size-5" />
            </button>
          </header>

          <p class="play-notif-settings__intro">
            Toasts in-app pendant la partie.
            <span class="play-notif-settings__count">
              {{ enabledCount }}/{{ NOTIFICATION_OPTIONS.length }} activées
            </span>
          </p>

          <ul class="play-notif-settings__list">
            <li
              v-for="option in NOTIFICATION_OPTIONS"
              :key="option.id"
              class="play-notif-settings__row"
            >
              <div class="play-notif-settings__row-main">
                <UIcon
                  :name="option.icon"
                  class="play-notif-settings__row-icon"
                  aria-hidden="true"
                />
                <div class="play-notif-settings__row-text">
                  <span class="play-notif-settings__row-label">{{ option.label }}</span>
                  <span class="play-notif-settings__row-desc">{{ option.description }}</span>
                </div>
              </div>
              <USwitch
                :model-value="prefs[option.id]"
                :aria-label="`${option.label} — ${prefs[option.id] ? 'activée' : 'désactivée'}`"
                @update:model-value="setEnabled(option.id, $event)"
              />
            </li>
          </ul>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
