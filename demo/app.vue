<template>
  <div>
    <header class="header">
      <h1>iOS-like Picker</h1>
      <a href="https://github.com/VanishMax/picker" target="_blank">
        <img src="/github.png" alt="github link">
      </a>
    </header>

    <section class="filters">
      <label>
        Radius
        <input :value="filters.radius" type="range" min="30" max="300" @change="changeFilter('radius', $event.target.value)">
        <span>{{ filters.radius }}</span>
      </label>
      <label>
        Perspective
        <input :value="filters.perspective" type="range" min="50" max="1000" step="10" @change="changeFilter('perspective', $event.target.value)">
        <span>{{ filters.perspective }}</span>
      </label>
      <label>
        Item height
        <input :value="filters.height" type="range" min="20" max="100" @change="changeFilter('height', $event.target.value)">
        <span>{{ filters.height }}</span>
      </label>
      <label>
        Sensitivity
        <input :value="filters.sensitivity" type="range" min="1" max="10" @change="changeFilter('sensitivity', $event.target.value)">
        <span>{{ filters.sensitivity }}</span>
      </label>
      <label>
        Amount of visible options
        <input :value="filters.options" type="range" min="4" max="30" step="2" @change="changeFilter('options', $event.target.value)">
        <span>{{ filters.options }}</span>
      </label>
      <label>
        <input :checked="filters.arrows" type="checkbox" @change="changeFilter('arrows', $event.target.checked)">
        Show arrows
      </label>
    </section>

    <Picker
      v-model="currentYear"
      :options="years"
      :radius="filters.radius"
      :perspective="filters.perspective"
      :sensitivity="filters.sensitivity"
      :item-height="filters.height"
      :visible-options-amount="filters.options"
      :arrows="filters.arrows"
      type="normal"
      ref="picker"
    >
      <template #arrow-top>⌃</template>
      <template #arrow-bottom>⌃</template>
    </Picker>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import Picker, { PickerValue } from '../src/picker.vue';

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

      filters: {
        radius: 190,
        perspective: 150,
        height: 40,
        sensitivity: 8,
        options: 10,
        arrows: true,
      } as Record<string, number|boolean>,
    };
  },
  methods: {
    changeFilter (field: string, val: string|boolean) {
      if (typeof val === 'boolean') {
        this.filters[field] = val;
      } else {
        this.filters[field] = parseInt(val, 10);
      }

      (this.$refs.picker as any).$forceUpdate();
    },
  },
});
</script>

<style lang="css">
body {
  font-family: Arial sans-serif;
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header img {
  width: 40px;
  height: 40px;
}

.header, .filters {
  max-width: 80%;
  margin: 0 auto;
}

.picker {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;

  max-width: 80%;
  height: 300px;
  margin: 16px auto 0;
  background-color: #F8F8FA;
  border-radius: 4px;

  text-align: center;
  font-size: 18px;
  color: #bbbcc9;
}

.picker_arrow {
  font-size: 18px;
  height: 20px;
  width: 24px;
  padding: 4px;
  margin: 0 auto;
}

.picker_arrow.bottom {
  transform: rotate(180deg);
}

.picker_chosen {
  background-color: #F8F8FA;
  border-top: 1px solid #dddde4;
  border-bottom: 1px solid #dddde4;
  color: #121212;
  font-size: 20px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
}

.filters label {
  margin-top: 12px;
  width: 50%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.filters label span {
  margin-left: 8px;
}

@media (max-width: 768px) {
  .filters label {
    width: 100%;
  }
}
</style>
