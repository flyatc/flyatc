import { RowType, Table } from "table";

interface CLITable<T> {
  data: Array<Array<T>>;
  headers?: Array<string>;
  empty: string;
}
export const table = <T>({ data, headers, empty }: CLITable<T>): string => {
  if (!data.length) {
    return empty;
  }

  let table = new Table();

  if (headers?.length) {
    table = table.header(headers);
  }

  table = table.body(data as Array<RowType>);

  return table.border().toString();
};
