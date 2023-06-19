import { PageElement } from '.';

interface PageContent {
  type: 'page' | 'continuation',
  header?: PageElement.Header;
  sections: PageElement.Section[];
  tabs?: PageElement.Tab[];
}

export default PageContent;
