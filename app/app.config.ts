export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'zinc',
    },
    button: {
      slots: {
        base: 'cursor-pointer',
      },
      variants: {
        size: {
          xs: { base: 'text-base' },
          sm: { base: 'text-base' },
          md: { base: 'text-base' },
          lg: { base: 'text-base' },
          xl: { base: 'text-base' },
        },
      },
    },
    select: {
      slots: {
        base: 'cursor-pointer',
      },
      variants: {
        size: {
          xs: { base: 'text-base', item: 'text-base', label: 'text-base', empty: 'text-base' },
          sm: { base: 'text-base', item: 'text-base', label: 'text-base', empty: 'text-base' },
          md: { base: 'text-base', item: 'text-base', label: 'text-base', empty: 'text-base' },
          lg: { base: 'text-base', item: 'text-base', label: 'text-base', empty: 'text-base' },
          xl: { base: 'text-base', item: 'text-base', label: 'text-base', empty: 'text-base' },
        },
      },
      compoundVariants: [
        { fixed: false, size: 'xs', class: 'md:text-base' },
        { fixed: false, size: 'sm', class: 'md:text-base' },
        { fixed: false, size: 'md', class: 'md:text-base' },
        { fixed: false, size: 'lg', class: 'md:text-base' },
      ],
    },
    input: {
      variants: {
        size: {
          xs: { base: 'text-base' },
          sm: { base: 'text-base' },
          md: { base: 'text-base' },
          lg: { base: 'text-base' },
          xl: { base: 'text-base' },
        },
      },
      compoundVariants: [
        { fixed: false, size: 'xs', class: 'md:text-base' },
        { fixed: false, size: 'sm', class: 'md:text-base' },
        { fixed: false, size: 'md', class: 'md:text-base' },
        { fixed: false, size: 'lg', class: 'md:text-base' },
      ],
    },
    textarea: {
      variants: {
        size: {
          xs: { base: 'text-base' },
          sm: { base: 'text-base' },
          md: { base: 'text-base' },
          lg: { base: 'text-base' },
          xl: { base: 'text-base' },
        },
      },
      compoundVariants: [
        { fixed: false, size: 'xs', class: 'md:text-base' },
        { fixed: false, size: 'sm', class: 'md:text-base' },
        { fixed: false, size: 'md', class: 'md:text-base' },
        { fixed: false, size: 'lg', class: 'md:text-base' },
      ],
    },
    tabs: {
      slots: {
        trigger: 'cursor-pointer',
      },
      variants: {
        size: {
          xs: { trigger: 'text-base' },
          sm: { trigger: 'text-base' },
          md: { trigger: 'text-base' },
          lg: { trigger: 'text-base' },
          xl: { trigger: 'text-base' },
        },
      },
    },
    navigationMenu: {
      slots: {
        link: 'cursor-pointer text-base',
        childLink: 'text-base',
        childLinkDescription: 'text-sm',
        label: 'text-base',
      },
    },
    switch: {
      slots: {
        base: 'cursor-pointer',
      },
      variants: {
        size: {
          xs: { wrapper: 'text-base', label: 'text-base', description: 'text-sm' },
          sm: { wrapper: 'text-base', label: 'text-base', description: 'text-sm' },
          md: { wrapper: 'text-base', label: 'text-base', description: 'text-sm' },
          lg: { wrapper: 'text-base', label: 'text-base', description: 'text-sm' },
          xl: { wrapper: 'text-base', label: 'text-base', description: 'text-base' },
        },
      },
    },
    checkbox: {
      slots: {
        base: 'cursor-pointer',
      },
      variants: {
        size: {
          xs: { wrapper: 'text-base', label: 'text-base', description: 'text-sm' },
          sm: { wrapper: 'text-base', label: 'text-base', description: 'text-sm' },
          md: { wrapper: 'text-base', label: 'text-base', description: 'text-sm' },
          lg: { wrapper: 'text-base', label: 'text-base', description: 'text-sm' },
          xl: { wrapper: 'text-base', label: 'text-base', description: 'text-base' },
        },
      },
    },
    formField: {
      slots: {
        label: 'text-base',
        description: 'text-sm',
        error: 'text-sm',
        hint: 'text-sm',
        help: 'text-sm',
      },
      variants: {
        size: {
          xs: { root: 'text-base' },
          sm: { root: 'text-base' },
          md: { root: 'text-base' },
          lg: { root: 'text-base' },
          xl: { root: 'text-base' },
        },
      },
    },
    badge: {
      variants: {
        size: {
          xs: { base: 'text-sm' },
          sm: { base: 'text-sm' },
          md: { base: 'text-sm' },
          lg: { base: 'text-base' },
          xl: { base: 'text-base' },
        },
      },
    },
  },
})
