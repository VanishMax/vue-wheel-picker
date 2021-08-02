<template>
  <div id="app">
    <Picker v-model="currentYear" :options="years" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import Picker from '@/picker.vue';
import { PickerValue } from '@/picker';

function getYears (): PickerValue[] {
  const currentYear = new Date().getFullYear();
  const years = [];

  for (let i = currentYear - 20; i < currentYear + 20; i++) {
    years.push({
      value: i.toString(),
      text: i.toString(),
    });
  }

  return years;
}

export default Vue.extend({
  name: 'ServeDev',
  components: {
    Picker,
  },
  data () {
    const years = getYears();
    const current = (new Date().getFullYear()).toString();

    return {
      years,
      currentYear: {
        value: current,
        text: current,
      },
    };
  },
});
</script>
