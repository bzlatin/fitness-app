import { ReactElement } from "react";
import { FlatList, FlatListProps } from "react-native";

export type LegendListProps<ItemT> = Omit<
  FlatListProps<ItemT>,
  "renderItem" | "data" | "keyExtractor"
> & {
  data: ItemT[];
  renderItem: ({ item, index }: { item: ItemT; index: number }) => ReactElement | null;
  keyExtractor: (item: ItemT, index: number) => string;
  estimatedItemSize?: number;
};

// Lightweight stand-in for Legend List 1.0 while the real package is unavailable.
export const LegendList = <ItemT,>({
  data,
  renderItem,
  keyExtractor,
  estimatedItemSize,
  ...rest
}: LegendListProps<ItemT>) => (
  <FlatList
    data={data}
    renderItem={({ item, index }) => renderItem({ item, index })}
    keyExtractor={keyExtractor}
    getItemLayout={
      estimatedItemSize
        ? (_data, index) => ({
            length: estimatedItemSize,
            offset: estimatedItemSize * index,
            index,
          })
        : undefined
    }
    {...rest}
  />
);
