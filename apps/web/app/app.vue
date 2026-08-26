<template>
  <UApp>
    <NuxtPwaManifest />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ClientOnly>
      <OfflineBlocker />
    </ClientOnly>
  </UApp>
</template>
