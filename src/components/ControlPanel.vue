<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

// Props & Emits
const autoRotation = defineModel<boolean>('autoRotation', { default: false })

// State
const isExpanded = ref(false)
const panelRef = ref<HTMLElement | null>(null)

// Toggle function
const toggleAutoRotation = () => {
  autoRotation.value = !autoRotation.value
}

const togglePanel = () => {
  isExpanded.value = !isExpanded.value
}

// Click Outside Logic
const handleClickOutside = (event: MouseEvent) => {
  if (panelRef.value && !panelRef.value.contains(event.target as Node)) {
    isExpanded.value = false
  }
}

watch(isExpanded, (newValue) => {
  if (newValue) {
    // Delay adding listener to avoid catching the current click event if it bubbles up
    // (though button is inside, better safe than sorry for other triggers)
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Status text
const statusText = computed(() => 
  autoRotation.value ? '已啟用' : '已停用'
)
</script>

<template>
  <div ref="panelRef" class="fixed top-4 right-4 z-50 select-none flex flex-col items-end">
    
    <!-- Toggle Button (Always Visible) -->
    <button 
      @click="togglePanel"
      class="bg-gray-800/90 backdrop-blur-md text-white p-2 rounded-full shadow-lg border border-gray-700/50 hover:bg-gray-700 transition-all duration-200 mb-2"
      :class="{ 'bg-blue-600/90 border-blue-500/50': isExpanded }"
    >
      <svg v-if="!isExpanded" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- Control Panel Card (Collapsible) -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform scale-95 opacity-0 origin-top-right"
      enter-to-class="transform scale-100 opacity-100 origin-top-right"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform scale-100 opacity-100 origin-top-right"
      leave-to-class="transform scale-95 opacity-0 origin-top-right"
    >
      <div 
        v-if="isExpanded"
        class="bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700/50 p-4 min-w-[200px] max-w-[90vw]"
      >
        <!-- Title -->
        <div class="text-white text-sm font-semibold mb-3 flex items-center gap-2">
          控制面板
        </div>

        <!-- Auto Rotation Toggle -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col">
            <span class="text-white text-sm font-medium">自動輪轉</span>
            <span 
              class="text-xs transition-colors duration-200"
              :class="autoRotation ? 'text-green-400' : 'text-gray-400'"
            >
              {{ statusText }}
            </span>
          </div>

          <!-- Toggle Switch -->
          <button
            @click="toggleAutoRotation"
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            :class="autoRotation ? 'bg-blue-500' : 'bg-gray-600'"
            role="switch"
            :aria-checked="autoRotation"
          >
            <span
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200"
              :class="autoRotation ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>

        <!-- Legend Section -->
        <div class="mt-4 pt-3 border-t border-gray-700/50">
          <h3 class="text-white text-xs font-semibold mb-2 flex items-center gap-1">
            圖例說明
          </h3>
          <div class="grid grid-cols-1 gap-2 text-xs text-gray-300">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-white/30 border border-white/50"></div>
              <span>球員防守範圍 (白色虛線圈)</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/50"></div>
              <span>防守 heatmap (僅反映出雙方球員的防守範圍距離)</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 flex items-center justify-center rounded-full bg-[#FF0000] border border-white shadow-sm">
                <svg class="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </div>
              <span>離球員防守範圍最遠的點</span>
            </div>
          </div>
        </div>

        <!-- Usage Section -->
        <div class="mt-3 pt-3 border-t border-gray-700/50">
          <h3 class="text-white text-xs font-semibold mb-2 flex items-center gap-1">
            使用方式
          </h3>
          <ul class="list-disc list-inside text-xs text-gray-300 space-y-1 ml-1">
            <li><span class="text-white font-medium">拖曳球員</span> 調整場上位置</li>
            <li>開啟 <span class="text-blue-400">自動輪轉</span> 模擬 A 隊跑位</li>
          </ul>
        </div>

        <!-- Info Text -->
        <div class="mt-3 pt-3 border-t border-gray-700/50">
          <p class="text-[10px] text-gray-400 leading-relaxed mb-2">
            * 自動輪轉僅供戰術參考，演算法持續優化中
          </p>
          
          <!-- Author Info -->
          <div class="flex items-center justify-between pt-2 border-t border-gray-700/30">
            <span class="text-[10px] text-gray-500">Designed by Chris Liu</span>
            <a 
              href="https://github.com/chrisliuqq" 
              target="_blank" 
              class="text-[10px] text-gray-500 hover:text-blue-400 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
