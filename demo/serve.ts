import Vue, { VNode } from 'vue';
import Dev from '../demo/app.vue';

Vue.config.productionTip = false;

new Vue({
  render: (h): VNode => h(Dev),
}).$mount('#app');
