<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'
import { languageOptions } from '@/i18n'
import type { AppLanguage } from '@/types/finance'

const props = withDefaults(
  defineProps<{
    label?: string
    language: AppLanguage
    tone?: 'dark' | 'light'
  }>(),
  {
    label: 'Idioma',
    tone: 'dark',
  },
)

const emit = defineEmits<{
  languageChange: [language: AppLanguage]
}>()

const root = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const flagCodes: Record<AppLanguage, string> = {
  'pt-BR': 'br',
  'en-US': 'us',
  'es-ES': 'es',
}

const options = computed(() =>
  languageOptions.map((option) => ({
    ...option,
    flagUrl: `https://flagcdn.com/${flagCodes[option.value]}.svg`,
  })),
)
const selectedOption = computed(() => options.value.find((option) => option.value === props.language) ?? options.value[0])
const selectedLabel = computed(() => selectedOption.value?.label ?? 'Portugues')
const selectedFlagUrl = computed(() => selectedOption.value?.flagUrl ?? 'https://flagcdn.com/br.svg')

function selectLanguage(language: AppLanguage) {
  emit('languageChange', language)
  isOpen.value = false
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <div ref="root" class="relative inline-flex">
    <button
      class="inline-flex h-10 items-center gap-2 rounded-lg border px-2.5 transition"
      :class="
        tone === 'light'
          ? 'border-[#d7e3dc] bg-white text-[#172019] shadow-sm hover:border-[#17c964]'
          : 'border-white/10 bg-[#101318] text-white hover:border-[#17c964]'
      "
      type="button"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-label="label"
      @click="isOpen = !isOpen"
    >
      <img class="h-5 w-7 rounded-sm object-cover shadow-sm" :alt="selectedLabel" :src="selectedFlagUrl" />
      <ChevronDown :size="15" aria-hidden="true" />
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 top-12 z-50 grid min-w-[60px] gap-1 rounded-lg border p-1 shadow-xl"
      :class="tone === 'light' ? 'border-[#d7e3dc] bg-white' : 'border-white/10 bg-[#101318]'"
      role="listbox"
      :aria-label="label"
    >
      <button
        v-for="option in options"
        :key="option.value"
        class="flex h-9 items-center justify-between gap-2 rounded-md px-2 transition"
        :class="
          option.value === language
            ? tone === 'light'
              ? 'bg-[#e8f8ee]'
              : 'bg-white/10'
            : tone === 'light'
              ? 'hover:bg-[#f1f7f3]'
              : 'hover:bg-white/10'
        "
        type="button"
        role="option"
        :aria-label="option.label"
        :aria-selected="option.value === language"
        :title="option.label"
        @click="selectLanguage(option.value)"
      >
        <img class="h-5 w-7 rounded-sm object-cover shadow-sm" :alt="option.label" :src="option.flagUrl" />
        <Check v-if="option.value === language" class="text-[#17c964]" :size="15" aria-hidden="true" />
        <span v-else class="w-[15px]"></span>
      </button>
    </div>
  </div>
</template>
