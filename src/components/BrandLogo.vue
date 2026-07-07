<script setup lang="ts">
import { computed } from 'vue'
import logoFull from '@/assets/brand/ifinanca-logo.png'
import logoMark from '@/assets/brand/ifinanca-logo-mark.png'
import logoWordmark from '@/assets/brand/ifinanca-logo-wide.png'

const props = withDefaults(
  defineProps<{
    alt?: string
    variant?: 'full' | 'mark' | 'wordmark'
  }>(),
  {
    alt: 'iFinanca',
    variant: 'wordmark',
  },
)

const source = computed(() => {
  if (props.variant === 'full') return logoFull
  if (props.variant === 'mark') return logoMark
  return logoWordmark
})
</script>

<template>
  <img :alt="alt" class="select-none rounded-md object-contain" draggable="false" :src="source" />
</template>
